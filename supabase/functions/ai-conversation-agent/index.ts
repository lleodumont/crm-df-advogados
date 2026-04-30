// supabase/functions/ai-conversation-agent/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const META_API_BASE = "https://graph.facebook.com/v18.0";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MAX_HISTORY_MESSAGES = 20;

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentPayload {
  message_id: string;
  phone: string;
  lead_id: string | null;
  content: string;
  message_type: string;
  media_url: string | null;
}

interface ConversationState {
  id: string;
  lead_id: string | null;
  phone: string;
  status: string;
  classificacao: string | null;
  tipo_demanda: string | null;
  dados_coletados: Record<string, unknown>;
  resumo: string | null;
  turno: number;
}

interface AgentResponse {
  mensagem: string;
  acao: "continuar" | "handoff_qualificado" | "handoff_processo_ativo" | "handoff_outro" | "nutricao";
  classificacao: "estrategico" | "qualificado" | "morno" | null;
  dados_coletados: Record<string, unknown>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  return clean.startsWith("55") ? clean : `55${clean}`;
}

// ── Send reply to lead via Meta API ───────────────────────────────────────

async function sendMetaMessage(
  phone: string,
  message: string,
  phoneNumberId: string,
  accessToken: string
): Promise<void> {
  const payload = {
    messaging_product: "whatsapp",
    to: formatPhone(phone),
    type: "text",
    text: { body: message },
  };

  const res = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Meta API error sending reply:", err);
    throw new Error(`Meta API error: ${res.status}`);
  }

  const data = await res.json();
  console.log("Reply sent, wamid:", data.messages?.[0]?.id);
}

// ── Send notification to SDR group via UAZAPI ─────────────────────────────

async function sendUazapiGroupMessage(
  supabase: ReturnType<typeof createClient>,
  message: string
): Promise<void> {
  const { data: uazapi } = await supabase
    .from("uazapi_instances")
    .select("base_url, api_key, sdr_group_id")
    .eq("is_active", true)
    .maybeSingle();

  if (!uazapi) {
    console.warn("No active UAZAPI instance configured — skipping group notification");
    return;
  }

  const headers = { "Content-Type": "application/json", "token": uazapi.api_key };

  const res = await fetch(`${uazapi.base_url}/send/text`, {
    method: "POST",
    headers,
    body: JSON.stringify({ number: uazapi.sdr_group_id, text: message }),
  });

  const responseText = await res.text();
  if (!res.ok) {
    console.error(`UAZAPI error: ${res.status} — ${responseText.slice(0, 200)}`);
  } else {
    console.log("SDR group notified via UAZAPI");
  }
}

// ── Build SDR summary message ──────────────────────────────────────────────

function buildSdrHeader(
  leadName: string,
  phone: string,
  classificacao: string | null,
  acao: string,
  leadId: string | null
): string {
  const crmBase = (Deno.env.get("CRM_BASE_URL") ?? "").replace(/\/$/, "");
  const crmLink = crmBase && leadId ? `\n🔗 *CRM:* ${crmBase}/leads/${leadId}` : "";

  if (acao === "handoff_qualificado") {
    const classLabel = classificacao === "estrategico" ? "⭐⭐ Estratégico" : "⭐ Qualificado";
    return [`🔔 *NOVO LEAD QUALIFICADO*`, ``, `👤 *Nome:* ${leadName}`, `📱 *Telefone:* ${phone}`, `${classLabel}${crmLink}`].join("\n");
  }
  if (acao === "handoff_processo_ativo") {
    return [`⚠️ *LEAD COM PROCESSO ATIVO*`, ``, `👤 *Nome:* ${leadName}`, `📱 *Telefone:* ${phone}${crmLink}`].join("\n");
  }
  return [`📋 *LEAD — OUTRA DEMANDA*`, ``, `👤 *Nome:* ${leadName}`, `📱 *Telefone:* ${phone}${crmLink}`].join("\n");
}

// ── Call Claude API (raw text, sem JSON wrapper) ──────────────────────────

async function callClaudeRaw(
  systemPrompt: string,
  modelo: string,
  conversationText: string
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: conversationText }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// ── Call Claude API ────────────────────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  modelo: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<AgentResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Claude API error:", err);
    throw new Error(`Claude API error: ${res.status}`);
  }

  const data = await res.json();
  const rawText = data.content?.[0]?.text ?? "";

  // Extrai JSON da resposta (Claude pode incluir texto antes/depois)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);

  // Fallback: se Claude respondeu em texto puro, usa o texto como mensagem e continua
  if (!jsonMatch) {
    console.warn("Claude response was not JSON — using raw text as message:", rawText.slice(0, 100));
    return {
      mensagem: rawText.trim(),
      acao: "continuar",
      classificacao: null,
      dados_coletados: {},
    };
  }

  return JSON.parse(jsonMatch[0]) as AgentResponse;
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    const payload: AgentPayload = await req.json();
    const { phone, lead_id, content, message_type } = payload;

    if (!phone || !content) {
      return new Response(JSON.stringify({ error: "missing phone or content" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Busca ou cria estado da conversa ───────────────────────────────

    // Upsert atômico: cria se não existe, retorna existente se já existe
    // Evita race condition quando Meta entrega o mesmo webhook 2x
    const { data: upsertedState, error: upsertError } = await supabase
      .from("ai_conversation_state")
      .upsert(
        { phone, lead_id, status: "ativo", turno: 0, dados_coletados: {} },
        { onConflict: "phone", ignoreDuplicates: true }
      )
      .select("*")
      .maybeSingle() as { data: ConversationState | null; error: unknown };

    // Se ignoreDuplicates=true e já existia, upsert retorna null — busca explícita
    let state: ConversationState | null = upsertedState;
    if (!state) {
      const { data: existing } = await supabase
        .from("ai_conversation_state")
        .select("*")
        .eq("phone", phone)
        .maybeSingle() as { data: ConversationState | null };
      state = existing;
    }

    if (!state) {
      console.error("Failed to create or fetch conversation state", upsertError);
      return new Response(JSON.stringify({ error: "state_error" }), { status: 500 });
    }

    // Se já está em handoff, nutricao ou encerrado, não responde
    if (state.status !== "ativo") {
      console.log(`Conversation ${phone} is ${state.status} — skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: state.status }), { status: 200 });
    }

    // Se um humano assumiu o atendimento, não responde
    if (lead_id) {
      const { data: leadCheck } = await supabase
        .from("leads")
        .select("human_takeover")
        .eq("id", lead_id)
        .maybeSingle();
      if (leadCheck?.human_takeover) {
        console.log(`Lead ${lead_id} (${phone}) has human_takeover=true — skipping AI response`);
        return new Response(JSON.stringify({ skipped: true, reason: "human_takeover" }), { status: 200 });
      }
    }

    // Anti-duplicate: incrementa turno atomicamente e verifica se já foi processado
    // Se dois requests chegam juntos, apenas um consegue incrementar de turno N para N+1
    const expectedTurno = state.turno;
    const { data: lockedState, error: lockError } = await supabase
      .from("ai_conversation_state")
      .update({ turno: expectedTurno + 1 })
      .eq("phone", phone)
      .eq("turno", expectedTurno)
      .select("*")
      .maybeSingle() as { data: ConversationState | null; error: unknown };

    if (!lockedState) {
      // Outro request já processou este turno (race condition detectada)
      console.warn(`Race condition detected for ${phone} at turno ${expectedTurno} — skipping duplicate`);
      return new Response(JSON.stringify({ skipped: true, reason: "duplicate" }), { status: 200 });
    }

    // Usa o estado com turno já incrementado
    state = { ...lockedState, turno: expectedTurno }; // turno original para contexto

    // ── 2. Carrega config do agente ───────────────────────────────────────

    const { data: config } = await supabase
      .from("ai_agent_configs")
      .select("system_prompt, modelo, max_turnos")
      .eq("is_active", true)
      .maybeSingle();

    if (!config) throw new Error("No active ai_agent_config found");

    // Se excedeu o limite de turnos, faz handoff automático
    if (state.turno >= config.max_turnos) {
      console.log(`Max turns (${config.max_turnos}) reached for ${phone} — auto handoff`);
      await supabase
        .from("ai_conversation_state")
        .update({ status: "handoff" })
        .eq("phone", phone);
      await sendUazapiGroupMessage(
        supabase,
        `⚠️ *LEAD — LIMITE DE TURNOS ATINGIDO*\n\n📱 *Telefone:* ${phone}\n\nConversa chegou ao limite de ${config.max_turnos} mensagens sem qualificação. Revisar manualmente.`
      );
      return new Response(JSON.stringify({ auto_handoff: true }), { status: 200 });
    }

    // ── 3. Busca histórico da conversa (últimas N mensagens) ──────────────

    // Busca as últimas N mensagens (desc) e inverte para ordem cronológica
    // Não filtramos por created_at do state pois a mensagem é salva antes do state ser criado
    const { data: history } = await supabase
      .from("whatsapp_messages")
      .select("direction, content, message_type, created_at")
      .eq("phone_number", phone)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY_MESSAGES);

    const messages: { role: "user" | "assistant"; content: string }[] = (history || [])
      .reverse()
      .map((msg) => ({
        role: msg.direction === "inbound" ? "user" : "assistant",
        content: msg.content || "",
      }));

    // ── 4. Adiciona contexto dos dados já coletados ao system prompt ──────

    const dadosColetadosCtx = Object.keys(state.dados_coletados).length > 0
      ? `\n\nDADOS JÁ COLETADOS NESTA CONVERSA (não pergunte novamente):\n${JSON.stringify(state.dados_coletados, null, 2)}`
      : "";

    const turnoCtx = state.turno > 0
      ? `\n\nCONTEXTO DO TURNO ATUAL: Este é o turno ${state.turno + 1} da conversa. A saudação inicial (Fase 0) JÁ FOI ENVIADA — NÃO repita "Olá! Aqui é a Rafaela...". Continue a conversa exatamente de onde o histórico acima parou.`
      : "";

    const formatReminder = `\n\n⚠️ LEMBRETE CRÍTICO: Você DEVE responder SEMPRE em JSON válido. NUNCA responda em texto puro. Sua resposta deve começar com { e terminar com }. Formato obrigatório: {"mensagem": "...", "acao": "continuar", "classificacao": null, "dados_coletados": {}}`;

    const systemWithContext = config.system_prompt + dadosColetadosCtx + turnoCtx + formatReminder;

    // ── 5. Chama Claude API ───────────────────────────────────────────────

    const agentResponse = await callClaude(systemWithContext, config.modelo, messages);
    console.log("Claude action:", agentResponse.acao, "| classification:", agentResponse.classificacao);

    // ── 6. Busca credenciais Meta para enviar reply ───────────────────────

    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    if (!phoneNumberId || !accessToken) {
      throw new Error("WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not set");
    }

    // ── 7. Envia reply ao lead ────────────────────────────────────────────

    await sendMetaMessage(phone, agentResponse.mensagem, phoneNumberId, accessToken);

    // Salva mensagem outbound no histórico
    await supabase.from("whatsapp_messages").insert({
      lead_id: lead_id || state.lead_id || null,
      phone_number: formatPhone(phone),
      message_type: "text",
      content: agentResponse.mensagem,
      direction: "outbound",
      status: "sent",
    });

    // ── 8. Atualiza dados coletados e turno ───────────────────────────────

    // Merge apenas valores não-nulos: evita sobrescrever dados já coletados com null
    const newDados = { ...state.dados_coletados };
    for (const [key, value] of Object.entries(agentResponse.dados_coletados)) {
      if (value !== null && value !== undefined) newDados[key] = value;
    }
    const newTurno = state.turno + 1;

    // ── 9. Executa ação ───────────────────────────────────────────────────

    const isHandoff = agentResponse.acao !== "continuar" && agentResponse.acao !== "nutricao";
    const isNutricao = agentResponse.acao === "nutricao";

    let newStatus = "ativo";
    if (isHandoff) newStatus = "handoff";
    if (isNutricao) newStatus = "nutricao";

    await supabase
      .from("ai_conversation_state")
      .update({
        status: newStatus,
        classificacao: agentResponse.classificacao,
        tipo_demanda: (newDados.tipo_demanda as string) ?? state.tipo_demanda,
        dados_coletados: newDados,
      })
      .eq("phone", phone);

    // Atualiza lead_answers no CRM com dados coletados
    if (lead_id && agentResponse.dados_coletados) {
      for (const [key, value] of Object.entries(agentResponse.dados_coletados)) {
        if (value === null || value === undefined) continue;
        await supabase.from("lead_answers").upsert(
          { lead_id, question_key: key, answer_value: String(value), source: "ai_agent" },
          { onConflict: "lead_id,question_key" }
        );
      }
    }

    // ── 10. Handoff: notifica grupo SDR ───────────────────────────────────

    if (isHandoff) {
      // Busca nome do lead
      let leadName = phone;
      if (lead_id) {
        const { data: lead } = await supabase
          .from("leads")
          .select("full_name")
          .eq("id", lead_id)
          .maybeSingle();
        leadName = lead?.full_name || phone;
      }

      // Gera briefing rico via Claude com base no histórico completo da conversa
      const briefingPrompt = `Você é um assistente especializado em preparar briefings de casos de divórcio para o time de SDR de um escritório de advocacia.

Com base na conversa abaixo, gere um briefing detalhado para o grupo de WhatsApp do time. Use APENAS informações que o lead realmente mencionou na conversa — não invente ou assuma nada.

FORMATO OBRIGATÓRIO (use exatamente esses emojis e seções, omita seções sem informação):

📌 SITUAÇÃO ATUAL
• [bullets com contexto da separação, tempo, iniciativa, se há acordo, cidade, situação emocional]

[se há filhos:]
👨‍👩‍👧‍👦 FILHOS
• [quantidade, nomes se mencionados, idades]
• [vínculo com o pai/mãe, rotina]

[se guarda foi discutida:]
🧒 GUARDA E CONVIVÊNCIA
• [situação atual, proposta de cada parte, ponto de conflito]

[se pensão foi discutida:]
💸 PENSÃO ALIMENTÍCIA
• [situação, valores se mencionados, nível de conflito]

💰 RENDA
• Ele/Ela: [profissão] — [renda aproximada]
• Ex-cônjuge: [profissão] — [renda aproximada]

[se há bens:]
🏠 IMÓVEIS / 🚗 VEÍCULOS / 💼 OUTROS BENS
• [detalhes de cada bem mencionado: valor, dívida, situação]

[se há conflitos claros:]
⚠️ PRINCIPAIS PONTOS DE CONFLITO
• [lista]

🎯 OBJETIVOS DO CLIENTE
• [o que o lead quer resolver]

📌 OBSERVAÇÕES RELEVANTES
• [perfil emocional, urgência, disposição para fechar]

Responda APENAS com o briefing formatado, sem introdução nem explicação.`;

      // Formata conversa como texto para o Claude gerar o briefing sem confundir roles
      const conversationText = messages
        .map((m) => `${m.role === "user" ? "LEAD" : "RAFAELA"}: ${m.content}`)
        .join("\n") + `\n\nRAFAELA: ${agentResponse.mensagem}`;

      const briefingTexto = await callClaudeRaw(
        briefingPrompt,
        config.modelo,
        `Conversa completa:\n\n${conversationText}`
      ).catch(() => "Sem briefing disponível.");

      await supabase
        .from("ai_conversation_state")
        .update({ resumo: briefingTexto })
        .eq("phone", phone);

      const header = buildSdrHeader(leadName, phone, agentResponse.classificacao, agentResponse.acao, lead_id);
      const sdrMessage = `${header}\n\n━━━━━━━━━━━━━━━━━\n${briefingTexto}`;

      await sendUazapiGroupMessage(supabase, sdrMessage);

      // Registra atividade no lead
      if (lead_id) {
        await supabase.from("lead_activities").insert({
          lead_id,
          type: "ai_handoff",
          content: `[Agente IA] Handoff executado: ${agentResponse.acao}. Classificação: ${agentResponse.classificacao || "outro"}`,
          channel: "whatsapp",
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, acao: agentResponse.acao, turno: newTurno }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("ai-conversation-agent error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
