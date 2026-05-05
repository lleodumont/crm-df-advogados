import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
  // Campos de qualificação enviados diretamente (landing pages, N8N, Make, Zapier)
  cargo?: string;
  num_colaboradores?: string;
  faturamento_mensal?: string;
}

// Função para calcular score baseado nas respostas
function calculateScore(formResponses: FormResponse[], familyIncomeRange?: string): {
  score_decision: number;
  score_urgency: number;
  score_assets: number;
  score_fit: number;
  total_score: number;
} {
  let scoreDecision = 0;
  let scoreUrgency = 0;
  let scoreAssets = 0;
  let scoreFit = 0;

  // Análise das respostas do formulário
  formResponses.forEach((response) => {
    const question = response.question.toLowerCase();
    const answer = response.answer.toLowerCase();

    // Score de Decisão (0-40)
    if (question.includes("investir") || question.includes("valor")) {
      if (answer.includes("500k") || answer.includes("1m") || answer.includes("milhão")) {
        scoreDecision += 40;
      } else if (answer.includes("100k") || answer.includes("200k")) {
        scoreDecision += 30;
      } else if (answer.includes("50k")) {
        scoreDecision += 20;
      } else {
        scoreDecision += 10;
      }
    }

    // Score de Urgência (0-30)
    if (question.includes("quando") || question.includes("prazo")) {
      if (answer.includes("imediato") || answer.includes("agora") || answer.includes("já")) {
        scoreUrgency += 30;
      } else if (answer.includes("mês") || answer.includes("semana")) {
        scoreUrgency += 20;
      } else if (answer.includes("3 meses") || answer.includes("trimestre")) {
        scoreUrgency += 15;
      } else {
        scoreUrgency += 5;
      }
    }

    // Score de Patrimônio (0-25) - baseado em respostas sobre renda/patrimônio
    if (question.includes("renda") || question.includes("patrimônio")) {
      if (answer.includes("acima") || answer.includes("alta") || answer.includes("20k")) {
        scoreAssets += 25;
      } else if (answer.includes("média") || answer.includes("10k")) {
        scoreAssets += 15;
      } else {
        scoreAssets += 5;
      }
    }

    // Score de Fit (0-5)
    if (question.includes("objetivo") || question.includes("meta")) {
      if (
        answer.includes("aposentadoria") ||
        answer.includes("investimento") ||
        answer.includes("crescimento")
      ) {
        scoreFit += 5;
      } else {
        scoreFit += 3;
      }
    }
  });

  // Ajuste baseado em family_income_range
  if (familyIncomeRange) {
    if (familyIncomeRange === "above_20k") {
      scoreAssets = Math.max(scoreAssets, 25);
    } else if (familyIncomeRange === "10k_to_20k") {
      scoreAssets = Math.max(scoreAssets, 15);
    } else if (familyIncomeRange === "5k_to_10k") {
      scoreAssets = Math.max(scoreAssets, 10);
    }
  }

  // Garantir que os scores não excedam os máximos
  scoreDecision = Math.min(scoreDecision, 40);
  scoreUrgency = Math.min(scoreUrgency, 30);
  scoreAssets = Math.min(scoreAssets, 25);
  scoreFit = Math.min(scoreFit, 5);

  const totalScore = scoreDecision + scoreUrgency + scoreAssets + scoreFit;

  return {
    score_decision: scoreDecision,
    score_urgency: scoreUrgency,
    score_assets: scoreAssets,
    score_fit: scoreFit,
    total_score: totalScore,
  };
}

// Função para determinar classificação baseada no score
function getClassification(totalScore: number): string {
  if (totalScore >= 70) return "estrategico";
  if (totalScore >= 40) return "qualificado";
  return "morno";
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Parse payload
    const payload: LeadPayload = await req.json();

    // Validações básicas
    if (!payload.full_name || !payload.phone) {
      return new Response(
        JSON.stringify({
          error: "full_name and phone are required fields",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Criar cliente Supabase com service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Calcular scores
    const scores = calculateScore(
      payload.form_responses || [],
      payload.family_income_range
    );

    const classification = getClassification(scores.total_score);

    // Inserir lead na tabela
    const { data: leadData, error: leadError } = await supabase
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
        classification: classification,
        score_decision: scores.score_decision,
        score_urgency: scores.score_urgency,
        score_assets: scores.score_assets,
        score_fit: scores.score_fit,
        score_total: scores.total_score,
        utm_source: payload.utm_source || null,
        utm_medium: payload.utm_medium || null,
        utm_campaign: payload.utm_campaign || null,
        utm_content: payload.utm_content || null,
        utm_term: payload.utm_term || null,
        campaign_id: payload.campaign_id || null,
        adset_id: payload.adset_id || null,
        ad_id: payload.ad_id || null,
        family_income_range: payload.family_income_range || null,
        cargo: payload.cargo || null,
      })
      .select()
      .single();

    if (leadError) {
      console.error("Error inserting lead:", leadError);
      return new Response(
        JSON.stringify({
          error: "Failed to insert lead",
          details: leadError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Inserir respostas do formulário
    const answersToInsert: { lead_id: string; question_key: string; answer_value: string; source: string }[] = [];

    // Formato array (Meta Lead Ads direto)
    if (payload.form_responses && payload.form_responses.length > 0) {
      for (const response of payload.form_responses) {
        answersToInsert.push({
          lead_id: leadData.id,
          question_key: response.question
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, ""),
          answer_value: response.answer,
          source: "meta_form",
        });
      }
    }

    // Campos flat (landing pages, N8N, Make, Zapier) — aceita variações de nome
    const cargoValue = payload.cargo || (payload as any).cargo_real;
    const colaboradoresValue = payload.num_colaboradores || (payload as any).colaboradores || (payload as any).num_colaboradores_real;
    const faturamentoValue = payload.faturamento_mensal || (payload as any).faturamento || (payload as any).faturamento_real;

    if (cargoValue) {
      answersToInsert.push({ lead_id: leadData.id, question_key: "cargo", answer_value: cargoValue, source: "meta_form" });
    }
    if (colaboradoresValue) {
      answersToInsert.push({ lead_id: leadData.id, question_key: "num_colaboradores", answer_value: colaboradoresValue, source: "meta_form" });
    }
    if (faturamentoValue) {
      answersToInsert.push({ lead_id: leadData.id, question_key: "faturamento_mensal", answer_value: faturamentoValue, source: "meta_form" });
    }

    // Verifica se form_responses contém cargo/colaboradores sob chaves normalizadas diferentes
    if (payload.form_responses) {
      const alreadyHasCargo = answersToInsert.some(a => a.question_key === "cargo");
      const alreadyHasColab = answersToInsert.some(a => a.question_key === "num_colaboradores");
      const alreadyHasFat = answersToInsert.some(a => a.question_key === "faturamento_mensal");

      for (const response of payload.form_responses) {
        const qLower = response.question.toLowerCase();
        if (!alreadyHasCargo && (qLower === "cargo" || qLower.includes("cargo") || qLower.includes("função") || qLower.includes("funcao"))) {
          answersToInsert.push({ lead_id: leadData.id, question_key: "cargo", answer_value: response.answer, source: "meta_form" });
        } else if (!alreadyHasColab && (qLower === "num_colaboradores" || qLower.includes("colaborador") || qLower.includes("funcionario") || qLower.includes("funcionário"))) {
          answersToInsert.push({ lead_id: leadData.id, question_key: "num_colaboradores", answer_value: response.answer, source: "meta_form" });
        } else if (!alreadyHasFat && (qLower === "faturamento_mensal" || qLower.includes("faturamento"))) {
          answersToInsert.push({ lead_id: leadData.id, question_key: "faturamento_mensal", answer_value: response.answer, source: "meta_form" });
        }
      }
    }

    if (answersToInsert.length > 0) {
      const { error: answersError } = await supabase
        .from("lead_answers")
        .insert(answersToInsert);

      if (answersError) {
        console.error("Error inserting answers:", answersError);
        // Não falha a operação, apenas loga o erro
      }
    }

    // Criar atividade inicial
    const { error: activityError } = await supabase
      .from("lead_activities")
      .insert({
        lead_id: leadData.id,
        type: "lead_created",
        content: `Lead criado via ${payload.source || "meta_ads"}`,
        channel: "webhook",
      });

    if (activityError) {
      console.error("Error inserting activity:", activityError);
      // Não falha a operação, apenas loga o erro
    }

    // Retornar sucesso
    return new Response(
      JSON.stringify({
        success: true,
        lead_id: leadData.id,
        classification: classification,
        total_score: scores.total_score,
        message: "Lead created successfully",
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
