import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const META_API_VERSION = "v18.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Busca execuções pendentes que já atingiram o horário agendado
    const { data: executions, error: fetchError } = await supabase
      .from("automation_executions")
      .select(`
        id,
        lead_id,
        flow_id,
        step_id,
        automation_steps (
          template_name,
          template_language,
          template_components,
          message_body
        ),
        automation_flows (
          instance_id
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .limit(50);

    if (fetchError) throw fetchError;

    if (!executions || executions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending executions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${executions.length} automation execution(s)`);

    let sent = 0;
    let failed = 0;

    for (const execution of executions) {
      const step = execution.automation_steps as {
        template_name: string;
        template_language: string;
        template_components: unknown[];
        message_body: string | null;
      } | null;

      const flow = execution.automation_flows as { instance_id: string | null } | null;

      if (!step || !flow) {
        await supabase
          .from("automation_executions")
          .update({ status: "failed", error: "Step or flow not found", executed_at: new Date().toISOString() })
          .eq("id", execution.id);
        failed++;
        continue;
      }

      // Busca dados do lead (telefone)
      const { data: lead } = await supabase
        .from("leads")
        .select("id, phone, full_name")
        .eq("id", execution.lead_id)
        .single();

      if (!lead || !lead.phone) {
        await supabase
          .from("automation_executions")
          .update({ status: "failed", error: "Lead not found or missing phone", executed_at: new Date().toISOString() })
          .eq("id", execution.id);
        failed++;
        continue;
      }

      // Busca instância WhatsApp
      let instanceId: string | null = null;
      let phoneNumberId: string | null = null;
      let accessToken: string | null = null;

      if (flow.instance_id) {
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("instance_id, phone_number_id, access_token")
          .eq("id", flow.instance_id)
          .single();

        if (instance) {
          instanceId = instance.instance_id;
          phoneNumberId = instance.phone_number_id;
          accessToken = instance.access_token;
        }
      }

      // Fallback para variáveis de ambiente
      phoneNumberId = phoneNumberId || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || null;
      accessToken = accessToken || Deno.env.get("WHATSAPP_ACCESS_TOKEN") || null;

      if (!phoneNumberId || !accessToken) {
        await supabase
          .from("automation_executions")
          .update({
            status: "failed",
            error: "WhatsApp credentials not configured",
            executed_at: new Date().toISOString(),
          })
          .eq("id", execution.id);
        failed++;
        continue;
      }

      // Formata telefone
      const cleanPhone = lead.phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

      // Monta payload Meta
      const metaPayload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: {
          name: step.template_name,
          language: { code: step.template_language || "pt_BR" },
          ...(step.template_components && (step.template_components as unknown[]).length > 0
            ? { components: step.template_components }
            : {}),
        },
      };

      try {
        const metaRes = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metaPayload),
        });

        const metaData = await metaRes.json();

        if (!metaRes.ok) {
          const errMsg = metaData?.error?.message || `Meta API error: ${metaRes.statusText}`;
          console.error(`Failed to send template to ${formattedPhone}:`, errMsg);

          await supabase.from("whatsapp_messages").insert({
            instance_id: flow.instance_id || null,
            lead_id: execution.lead_id,
            phone_number: formattedPhone,
            message_type: "template",
            content: step.message_body || step.template_name,
            direction: "outbound",
            status: "failed",
            error: errMsg,
          });

          await supabase
            .from("automation_executions")
            .update({ status: "failed", error: errMsg, executed_at: new Date().toISOString() })
            .eq("id", execution.id);

          failed++;
        } else {
          const externalId = metaData.messages?.[0]?.id;
          console.log(`Sent template ${step.template_name} to ${formattedPhone}, msg id: ${externalId}`);

          // Salva mensagem no histórico do lead
          await supabase.from("whatsapp_messages").insert({
            instance_id: flow.instance_id || null,
            lead_id: execution.lead_id,
            phone_number: formattedPhone,
            message_type: "template",
            content: step.message_body || step.template_name,
            direction: "outbound",
            status: "sent",
            external_id: externalId || null,
          });

          await supabase
            .from("automation_executions")
            .update({ status: "sent", executed_at: new Date().toISOString() })
            .eq("id", execution.id);

          // Registra atividade no lead
          await supabase.from("lead_activities").insert({
            lead_id: execution.lead_id,
            type: "msg_sent",
            content: `[Automação] Template enviado: ${step.template_name}`,
            channel: "whatsapp",
          });

          sent++;
        }
      } catch (sendErr) {
        const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.error("Send error:", errMsg);
        await supabase
          .from("automation_executions")
          .update({ status: "failed", error: errMsg, executed_at: new Date().toISOString() })
          .eq("id", execution.id);
        failed++;
      }

      // Rate limiting: 500ms entre envios
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ success: true, processed: executions.length, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("automation-runner error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
