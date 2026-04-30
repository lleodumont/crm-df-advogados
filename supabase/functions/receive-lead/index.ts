import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const META_PIXEL_ID = "988235980206807";

async function sha256hex(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sendMetaCAPI(params: {
  eventName: string;
  phone?: string;
  fullName?: string;
  fbclid?: string;
  eventId?: string;
  eventSourceUrl?: string;
}) {
  const accessToken = Deno.env.get("META_PIXEL_ACCESS_TOKEN");
  if (!accessToken) return;

  const userData: Record<string, string> = {};
  if (params.phone) userData.ph = await sha256hex(params.phone.replace(/\D/g, ""));
  if (params.fullName) {
    const parts = params.fullName.toLowerCase().trim().split(/\s+/);
    userData.fn = await sha256hex(parts[0]);
    if (parts.length > 1) userData.ln = await sha256hex(parts[parts.length - 1]);
  }
  if (params.fbclid) userData.fbc = `fb.1.${Date.now()}.${params.fbclid}`;

  const event: Record<string, unknown> = {
    event_name: params.eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    user_data: userData,
  };
  if (params.eventId) event.event_id = params.eventId;
  if (params.eventSourceUrl) event.event_source_url = params.eventSourceUrl;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${accessToken}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: [event] }) }
    );
    if (!res.ok) console.error("CAPI error:", await res.text());
  } catch (e) {
    console.error("CAPI fetch error:", e);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Campos de qualificação que vêm como campos planos (SaveMyLeads)
// Mapeados para as question_keys exatas que calculate_lead_score usa
const QUALIFICATION_KEY_MAP: Record<string, string> = {
  decisao_real: "decisao_real",
  urgencia_real: "urgencia_real",
  conflito_real: "conflito_real",
  valor_bens_real: "valor_bens_real",
  filhos_menores_real: "filhos_menores_real",
  estagio_real: "estagio",
};

// Mapeia os textos do formulário Meta para os tokens de scoring
const ANSWER_TOKEN_MAP: Record<string, string> = {
  // decisao_real
  "sim,_já_estou_decidido(a)": "decidi_estruturar",
  "estou_muito_inclinado(a),_mas_ainda_avaliando": "quase_decidido",
  "ainda_estou_pensando": "avaliando",
  // urgencia_real
  "preciso_resolver_isso_imediatamente": "alta",
  "quero_resolver_nos_próximos_meses": "media",
  "ainda_estou_apenas_buscando_informações": "baixa",
  // valor_bens_real
  "acima_de_r$_1_milhão": "acima_1m",
  "entre_r$_500_mil_e_r$_1_milhão": "500k_1m",
  "entre_r$_200_mil_e_r$_500_mil": "200k_500k",
  "entre_r$_100_mil_e_r$_500_mil": "100k_500k",
  "menos_de_r$_100_mil": "ate_200k",
  "menos_de_r$_200_mil": "ate_200k",
  "não_há_bens": "ate_200k",
  "nao_ha_bens": "ate_200k",
};

function normalizeAnswerValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  return ANSWER_TOKEN_MAP[normalized] ?? value.trim();
}

interface FormResponse {
  question: string;
  answer: string;
}

interface LeadPayload {
  full_name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  source?: string;
  campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  form_responses?: FormResponse[];
  family_income_range?: string;
}

// Parse body conforme content-type (JSON ou form-urlencoded)
async function parseBody(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const result: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      // Remove \r\n que SaveMyLeads às vezes injeta nas chaves
      result[key.trim().replace(/[\r\n]/g, "")] = value;
    }
    return result;
  }

  return await req.json();
}

interface NormalizedPayload extends LeadPayload {
  qualificationAnswers: FormResponse[];
}

// Normaliza payload de qualquer formato para LeadPayload
function normalizePayload(raw: Record<string, string>): NormalizedPayload {
  // Suporte a formato SaveMyLeads (firstName + whatsapp) e formato nativo (full_name + phone)
  const full_name = raw.full_name || raw.firstName || raw.first_name || "";
  // Normaliza telefone: remove +, espaços e traços
  const rawPhone = raw.phone || raw.whatsapp || raw.telefone || "";
  const phone = rawPhone.replace(/[\+\s\-]/g, "");

  // IDs de campanha: suporte a group-id/ad-id/campaign-id e adset_id/ad_id/campaign_id
  const campaign_id = raw.campaign_id || raw["campaign-id"] || undefined;
  const adset_id = raw.adset_id || raw["group-id"] || raw["adset-id"] || undefined;
  const ad_id = raw.ad_id || raw["ad-id"] || undefined;

  // Campos de qualificação vindos como campos planos (SaveMyLeads)
  // Mapeados para question_keys da seção "Respostas do Formulário" no CRM
  const qualificationAnswers: FormResponse[] = [];
  for (const [rawKey, crmKey] of Object.entries(QUALIFICATION_KEY_MAP)) {
    const value = raw[rawKey];
    if (value && value.trim() !== "") {
      qualificationAnswers.push({ question: crmKey, answer: normalizeAnswerValue(value) });
    }
  }

  // form_responses no formato nativo (JSON array)
  const nativeFormResponses: FormResponse[] = Array.isArray(raw.form_responses)
    ? (raw.form_responses as unknown as FormResponse[])
    : [];

  return {
    full_name,
    phone,
    email: raw.email || undefined,
    city: raw.city || raw.cidade || undefined,
    state: raw.state || raw.estado || undefined,
    source: raw.source || "meta_ads",
    campaign: raw.campaign || raw.utm_campaign || raw.utm_medium || undefined,
    utm_source: raw.utm_source || undefined,
    utm_medium: raw.utm_medium || undefined,
    utm_campaign: raw.utm_campaign || undefined,
    utm_content: raw.utm_content || undefined,
    utm_term: raw.utm_term || undefined,
    campaign_id,
    adset_id,
    ad_id,
    form_responses: [...nativeFormResponses, ...qualificationAnswers],
    family_income_range: raw.family_income_range || undefined,
    qualificationAnswers,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const raw = await parseBody(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Update mode: add a single answer to an existing lead
    if (raw.lead_id && raw.question_key) {
      const leadId = String(raw.lead_id);
      const qKey = String(raw.question_key).trim().toLowerCase()
        .replace(/[\r\n]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const aVal = String(raw.answer_value ?? "").trim();

      const { error } = await supabase.from("lead_answers").insert({
        lead_id: leadId,
        question_key: qKey,
        answer_value: aVal,
        source: "meta_form",
      });

      if (error) console.error("Error inserting answer:", error);
      else await supabase.rpc("calculate_lead_score", { p_lead_id: leadId });

      // Fire CompleteRegistration when client signals last question answered
      if (!error && raw.complete === "true") {
        const { data: lead } = await supabase
          .from("leads").select("phone, full_name").eq("id", leadId).maybeSingle();
        if (lead) {
          sendMetaCAPI({
            eventName: "CompleteRegistration",
            phone: lead.phone,
            fullName: lead.full_name,
            eventId: raw.event_id,
            eventSourceUrl: raw.event_source_url,
          });
        }
      }

      return new Response(
        JSON.stringify({ success: !error, lead_id: leadId }),
        { status: error ? 500 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = normalizePayload(raw);

    if (!payload.full_name || !payload.phone) {
      return new Response(
        JSON.stringify({ error: "full_name (or firstName) and phone (or whatsapp) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplication: check if lead with same phone already exists
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("phone", payload.phone)
      .maybeSingle();

    let leadData: { id: string };

    if (existing) {
      // Return existing lead — skip creation to avoid duplicates
      leadData = existing;
      console.log(`Duplicate lead skipped for phone ${payload.phone}, using existing id ${existing.id}`);
    } else {
      const { data: inserted, error: leadError } = await supabase
        .from("leads")
        .insert({
          full_name: payload.full_name,
          phone: payload.phone,
          email: payload.email || null,
          city: payload.city || null,
          state: payload.state || null,
          source: payload.source || "meta_ads",
          campaign: payload.campaign || null,
          status: "novo",
          utm_source: payload.utm_source || null,
          utm_medium: payload.utm_medium || null,
          utm_campaign: payload.utm_campaign || null,
          utm_content: payload.utm_content || null,
          utm_term: payload.utm_term || null,
          campaign_id: payload.campaign_id || null,
          adset_id: payload.adset_id || null,
          ad_id: payload.ad_id || null,
          family_income_range: payload.family_income_range || null,
        })
        .select()
        .single();

      if (leadError) {
        console.error("Error inserting lead:", leadError);
        return new Response(
          JSON.stringify({ error: "Failed to insert lead", details: leadError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      leadData = inserted!;
    }

    // Inserir respostas de qualificação
    if (payload.form_responses && payload.form_responses.length > 0) {
      const answersToInsert = payload.form_responses.map((response) => ({
        lead_id: leadData.id,
        question_key: response.question.trim().toLowerCase().replace(/[\r\n]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
        answer_value: response.answer,
        source: "meta_form",
      }));

      const { error: answersError } = await supabase
        .from("lead_answers")
        .insert(answersToInsert);

      if (answersError) {
        console.error("Error inserting answers:", answersError);
      }
    }

    // Calcular score com as respostas do formulário
    if (payload.form_responses && payload.form_responses.length > 0) {
      await supabase.rpc("calculate_lead_score", { p_lead_id: leadData.id });
    }

    // Atividade inicial e automações apenas para leads novos (não duplicatas)
    if (!existing) {
      await supabase.from("lead_activities").insert({
        lead_id: leadData.id,
        type: "lead_created",
        content: `Lead criado via ${payload.source || "meta_ads"}`,
        channel: "webhook",
      });

      // CAPI Lead event
      sendMetaCAPI({
        eventName: "Lead",
        phone: payload.phone,
        fullName: payload.full_name,
        fbclid: raw.fbclid,
        eventId: raw.capi_event_id,
        eventSourceUrl: raw.event_source_url,
      });
    }

    // Enfileirar execuções de automação para fluxos ativos do tipo new_lead
    if (!existing) try {
      const { data: flows } = await supabase
        .from("automation_flows")
        .select("id, instance_id, automation_steps(id, step_order, delay_minutes)")
        .eq("is_active", true)
        .eq("trigger_type", "new_lead")
        .order("step_order", { referencedTable: "automation_steps", ascending: true });

      if (flows && flows.length > 0) {
        const executions: {
          flow_id: string;
          step_id: string;
          lead_id: string;
          status: string;
          scheduled_at: string;
        }[] = [];

        const now = Date.now();
        for (const flow of flows) {
          const steps = flow.automation_steps as { id: string; step_order: number; delay_minutes: number }[];
          let accumulatedMs = 0;
          for (const step of steps) {
            accumulatedMs += step.delay_minutes * 60 * 1000;
            executions.push({
              flow_id: flow.id,
              step_id: step.id,
              lead_id: leadData.id,
              status: "pending",
              scheduled_at: new Date(now + accumulatedMs).toISOString(),
            });
          }
        }

        if (executions.length > 0) {
          const { error: execError } = await supabase
            .from("automation_executions")
            .insert(executions);
          if (execError) console.error("Error enqueuing automation executions:", execError);
          else console.log(`Enqueued ${executions.length} automation step(s) for lead ${leadData.id}`);
        }
      }
    } catch (autoErr) {
      console.error("Error setting up automations:", autoErr);
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: leadData.id, duplicate: !!existing }),
      { status: existing ? 200 : 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
