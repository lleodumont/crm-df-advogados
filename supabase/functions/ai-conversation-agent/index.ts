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

  const res = await fetch(`${uazapi.base_url}/message/sendText/${uazapi.sdr_group_id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": uazapi.api_key,
    },
    body: JSON.stringify({ text: message }),
  });

  if (!res.ok) {
    console.error("UAZAPI error:", await res.text());
  } else {
    console.log("SDR group notified via UAZAPI");
  }
}

// ── Build SDR summary message ──────────────────────────────────────────────

function buildSdrSummary(
  leadName: string,
  phone: string,
  classificacao: string | null,
  dados: Record<string, unknown>,
  acao: string,
  resumo: string
): string {
  if (acao === "handoff_qualificado") {
    const classLabel = classificacao === "estrategico" ? "⭐⭐ Estratégico" : "⭐ Qualificado";
    return [
      `🔔 *NOVO LEAD QUALIFICADO*`,
      ``,
      `👤 *Nome:* ${leadName}`,
      `📱 *Telefone:* ${phone}`,
      `${classLabel}`,
      ``,
      `━━━━━━━━━━━━━━━━━`,
      `📌 *SITUAÇÃO*`,
      `• Separados de fato: ${dados.separados_de_fato ? `Sim${dados.tempo_separacao ? ` — ${dados.tempo_separacao}` : ""}` : "Não"}`,
      `• Ainda moram juntos: ${dados.moram_juntos ? "Sim" : "Não"}`,
      `• Processo judicial: ${dados.processo_ativo ? "Sim" : "Não"}`,
      ``,
      `👨‍👩‍👧 *FILHOS*`,
      `• ${dados.filhos ? `${dados.qtd_filhos || "Sim"} — idades: ${dados.idades_filhos || "não informado"}` : "Não tem"}`,
      `• Guarda: ${dados.guarda_definida ? "Definida" : "Não definida"}`,
      `• Pensão: ${dados.pensao_definida ? "Definida" : "Não definida"}`,
      ``,
      `🏠 *BENS*`,
      `• Imóveis: ${dados.imoveis ? "Sim" : "Não"}`,
      `• Veículos: ${dados.veiculos ? "Sim" : "Não"}`,
      `• Investimentos: ${dados.investimentos ? "Sim" : "Não"}`,
      `• Empresa: ${dados.empresa ? "Sim" : "Não"}`,
      ``,
      `📋 *Regime de bens:* ${dados.regime_bens || "não informado"}`,
      ``,
      `💰 *RENDA*`,
      `• Lead: ${dados.profissao_lead || "?"} — ${dados.renda_lead || "não informado"}`,
      `• Ex-cônjuge: ${dados.profissao_ex || "?"} — ${dados.renda_ex || "não informado"}`,
      ``,
      `━━━━━━━━━━━━━━━━━`,
      `💬 *CONTEXTO*`,
      resumo,
    ].join("\n");
  }

  if (acao === "handoff_processo_ativo") {
    return [
      `⚠️ *LEAD COM PROCESSO ATIVO*`,
      ``,
      `👤 *Nome:* ${leadName}`,
      `📱 *Telefone:* ${phone}`,
      ``,
      `━━━━━━━━━━━━━━━━━`,
      `📌 *SITUAÇÃO*`,
      `• Já possui processo litigioso em andamento`,
      `• Cópia do processo: a caminho`,
      ``,
      `📋 *Dados coletados:*`,
      `• Regime de bens: ${dados.regime_bens || "não informado"}`,
      `• Filhos: ${dados.filhos ? `${dados.qtd_filhos || "sim"} — ${dados.idades_filhos || ""}` : "Não"}`,
      `• Imóveis: ${dados.imoveis ? "Sim" : "Não"} | Veículos: ${dados.veiculos ? "Sim" : "Não"}`,
      ``,
      `💬 *CONTEXTO*`,
      resumo,
    ].join("\n");
  }

  // handoff_outro
  return [
    `📋 *LEAD — OUTRA DEMANDA*`,
    ``,
    `👤 *Nome:* ${leadName}`,
    `📱 *Telefone:* ${phone}`,
    ``,
    `━━━━━━━━━━━━━━━━━`,
    `📌 *DEMANDA:* ${dados.descricao_outra_demanda || "Não especificada"}`,
    ``,
    `💬 *RESUMO DO CASO*`,
    resumo,
  ].join("\n");
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
  if (!jsonMatch) throw new Error(`Claude response is not JSON: ${rawText}`);

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

    const systemWithContext = config.system_prompt + dadosColetadosCtx + turnoCtx;

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

      // Gera resumo via Claude em formato JSON (mesmo padrão da função callClaude)
      const resumoPrompt = `Você é um assistente que gera resumos concisos de conversas de qualificação de leads.
Gere um resumo de 2-3 frases descrevendo a situação emocional e urgência do lead.
Responda APENAS com JSON no formato: {"mensagem": "seu resumo aqui", "acao": "continuar", "classificacao": null, "dados_coletados": {}}`;

      const resumoResponse = await callClaude(
        resumoPrompt,
        config.modelo,
        messages
      ).catch(() => ({ mensagem: "Sem resumo disponível.", acao: "continuar" as const, classificacao: null, dados_coletados: {} }));

      const resumoTexto = resumoResponse.mensagem || "Sem resumo disponível.";

      await supabase
        .from("ai_conversation_state")
        .update({ resumo: resumoTexto })
        .eq("phone", phone);

      const sdrMessage = buildSdrSummary(
        leadName,
        phone,
        agentResponse.classificacao,
        newDados,
        agentResponse.acao,
        resumoTexto
      );

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
