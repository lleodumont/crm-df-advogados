import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UAZAPI_BASE_URL = "https://api.uazapi.com";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const uazapiToken = Deno.env.get("UAZAPI_TOKEN");

    if (!uazapiToken) {
      throw new Error("UAZAPI_TOKEN not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { instanceId, phoneNumber, message, leadId }: SendMessageRequest = await req.json();

    if (!instanceId || !phoneNumber || !message) {
      throw new Error("Missing required fields: instanceId, phoneNumber, message");
    }

    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError) throw userError;

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("instance_id", instanceId)
      .single();

    if (!instance) {
      throw new Error("WhatsApp instance not found");
    }

    const response = await fetch(
      `${UAZAPI_BASE_URL}/message/send-text`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${uazapiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instanceId,
          phone: formattedPhone,
          message,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`UazAPI error: ${errorData.message || response.statusText}`);
    }

    const responseData = await response.json();

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
        sent_by: userData.user.id,
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
