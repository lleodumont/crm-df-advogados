import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UAZAPI_URL = "https://grupodumont.uazapi.com";
const UAZAPI_TOKEN = "3fa73dd7-a2bb-4ef6-b98f-de41ba9ab511";
const GRUPO_JID = "120363406067768232@g.us"; // Comercial DF advogados

function v(val: any, fallback = "-"): string {
  if (val === null || val === undefined || val === "") return fallback;
  return String(val);
}

function classificacaoEmoji(c: string | null): string {
  if (c === "estrategico") return "🔥 Estratégico";
  if (c === "qualificado") return "✅ Qualificado";
  return "🌡️ Morno";
}

function labelDecisao(val: string | null): string {
  const map: Record<string, string> = {
    decidi_estruturar: "Decidido a estruturar",
    quase_decidido: "Quase decidido",
    avaliando: "Ainda avaliando",
  };
  return val ? (map[val] ?? val) : "-";
}

function labelUrgencia(val: string | null): string {
  const map: Record<string, string> = {
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
  };
  return val ? (map[val] ?? val) : "-";
}

function labelPrazo(val: string | null): string {
  const map: Record<string, string> = {
    ate_7_dias: "Até 7 dias",
    ate_30_dias: "Até 30 dias",
    sem_prazo: "Sem prazo definido",
  };
  return val ? (map[val] ?? val) : "-";
}

function labelAutonomia(val: string | null): string {
  const map: Record<string, string> = {
    decido_sozinho: "Decide sozinho",
    preciso_alinhar: "Precisa alinhar",
    nao_sei: "Não sabe",
  };
  return val ? (map[val] ?? val) : "-";
}

function labelPatrimonio(val: string | null): string {
  const map: Record<string, string> = {
    acima_1m: "Acima de R$ 1M",
    "500k_1m": "R$ 500k – R$ 1M",
    "200k_500k": "R$ 200k – R$ 500k",
    ate_200k: "Até R$ 200k",
  };
  return val ? (map[val] ?? val) : "-";
}

function labelFit(val: string | null): string {
  const map: Record<string, string> = {
    conducao_completa: "Sim, condução completa",
    nao_sei: "Não sabe",
  };
  return val ? (map[val] ?? val) : "-";
}

function formatarMensagem(lead: any, answers: Record<string, string>): string {
  const a = (key: string) => answers[key] ?? null;

  const linhas = [
    `🔔 *Novo lead chegou no CRM!*`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *DADOS PESSOAIS*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `• *Nome:* ${v(lead.full_name)}`,
    `• *Telefone:* ${v(lead.phone)}`,
    `• *E-mail:* ${v(lead.email)}`,
    `• *Cidade/UF:* ${v(lead.city)} / ${v(lead.state)}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 *RESPOSTAS DO FORMULÁRIO*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `• *Decisão:* ${labelDecisao(a("decisao_real") ?? a("decisao"))}`,
    `• *Urgência:* ${labelUrgencia(a("urgencia_real") ?? a("urgencia"))}`,
    `• *Prazo:* ${labelPrazo(a("prazo_real") ?? a("timeline_start"))}`,
    `• *Autonomia:* ${labelAutonomia(a("autonomia_real") ?? a("authority"))}`,
    `• *Patrimônio:* ${labelPatrimonio(a("valor_bens_real") ?? a("bens") ?? a("assets_range"))}`,
    `• *Tipo de bens:* ${v(a("tipo_bens_real") ?? a("assets_types"))}`,
    `• *Filhos menores:* ${v(a("filhos_menores_real") ?? a("filhos"))}`,
    `• *Renda familiar:* ${v(lead.family_income_range ?? a("renda_real") ?? a("renda"))}`,
    `• *Fit com oferta:* ${labelFit(a("offer_fit"))}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📣 *ORIGEM / UTM*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `• *Origem:* ${v(lead.source)}`,
    `• *Campanha:* ${v(lead.campaign)}`,
    `• *UTM Source:* ${v(lead.utm_source)}`,
    `• *UTM Medium:* ${v(lead.utm_medium)}`,
    `• *UTM Campaign:* ${v(lead.utm_campaign)}`,
    `• *UTM Content:* ${v(lead.utm_content)}`,
    `• *UTM Term:* ${v(lead.utm_term)}`,
    `• *Ad ID:* ${v(lead.ad_id)}`,
    `• *Adset ID:* ${v(lead.adset_id)}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🎯 *SCORE & CLASSIFICAÇÃO*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `• *Classificação:* ${classificacaoEmoji(lead.classification)}`,
    `• *Score total:* ${lead.score_total ?? 0} pts`,
    `• *Score decisão:* ${lead.score_decision ?? 0}`,
    `• *Score urgência:* ${lead.score_urgency ?? 0}`,
    `• *Score patrimônio:* ${lead.score_assets ?? 0}`,
    `• *Score fit:* ${lead.score_fit ?? 0}`,
    ``,
    `🔗 *CRM:* https://crm.deborafernandesadv.com.br/leads/${lead.id}`,
  ];

  return linhas.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json();
    const lead = body.record ?? body;

    if (!lead?.id) {
      return new Response(JSON.stringify({ error: "No lead data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aguarda 3s para garantir que as respostas do formulário já foram gravadas
    await new Promise((r) => setTimeout(r, 3000));

    // Busca lead completo + respostas do formulário
    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(supabaseUrl, serviceKey);

    const [{ data: leadData }, { data: answersData }] = await Promise.all([
      supabase.from("leads").select("*").eq("id", lead.id).single(),
      supabase.from("lead_answers").select("question_key, answer_value").eq("lead_id", lead.id),
    ]);

    const fullLead = leadData ?? lead;
    const answers: Record<string, string> = {};
    for (const row of (answersData ?? [])) {
      answers[row.question_key] = row.answer_value;
    }

    const mensagem = formatarMensagem(fullLead, answers);

    const res = await fetch(`${UAZAPI_URL}/send/text`, {
      method: "POST",
      headers: { "token": UAZAPI_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ number: GRUPO_JID, text: mensagem }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Uazapi error:", err);
      return new Response(JSON.stringify({ error: "Uazapi error", detail: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Notificação enviada: ${fullLead.full_name}`);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
