import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendMessageRequest {
  instanceId: string;
  phoneNumber: string;
  message: string;
  leadId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("Starting whatsapp-send function");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { instanceId, phoneNumber, message, leadId }: SendMessageRequest = await req.json();
    console.log("Received request:", { instanceId, phoneNumber, leadId, messageLength: message.length });

    if (!instanceId || !phoneNumber || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: instanceId, phoneNumber, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    console.log("Formatted phone:", formattedPhone);

    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from JWT (already validated by Supabase since verifyJWT=true)
    const token = authHeader.replace("Bearer ", "");
    const parts = token.split('.');
    if (parts.length !== 3) {
      return new Response(
        JSON.stringify({ error: "Invalid token format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let userId;
    try {
      const payload = JSON.parse(atob(parts[1]));
      userId = payload.sub;
      console.log("User ID from JWT:", userId);
    } catch (e) {
      console.error("Failed to decode JWT:", e);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id, token, api_url")
      .eq("instance_id", instanceId)
      .single();

    if (instanceError || !instance) {
      console.error("Instance error:", instanceError);
      throw new Error("WhatsApp instance not found");
    }

    if (!instance.token) {
      throw new Error("Instance token not configured. Please update the instance with API credentials.");
    }
    console.log("Instance found:", instance.id);

    const n8nWebhookUrl = "https://webhooks.globalsaleshub.tech/webhook/217e97de-e983-4394-9570-6723b6152917";
    const webhookPayload = {
      instanceId,
      phone: formattedPhone,
      message,
      token: instance.token,
    };
    console.log("Sending to n8n webhook:", { url: n8nWebhookUrl, payload: { ...webhookPayload, token: "***" } });

    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    });

    console.log("n8n response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("n8n error response:", errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        throw new Error(`n8n webhook error: ${response.statusText} - ${errorText}`);
      }
      throw new Error(`n8n webhook error: ${errorData.message || response.statusText}`);
    }

    let responseData;
    try {
      const responseText = await response.text();
      console.log("n8n raw response:", responseText);
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.log("n8n returned non-JSON response, using empty object");
      responseData = {};
    }

    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        instance_id: instance.id,
        lead_id: leadId || null,
        phone_number: formattedPhone,
        message_type: "text",
        content: message,
        direction: "outbound",
        status: "sent",
        external_id: responseData.messageId || responseData.id,
        sent_by: userId,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return new Response(
      JSON.stringify({ success: true, message: savedMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
