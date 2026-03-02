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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    // Create client with user's JWT to validate session
    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Validate the user session
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth validation failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log("Authenticated user ID:", userId);

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    if (!instance.api_url) {
      throw new Error("Instance API URL not configured. Please update the instance.");
    }

    console.log("Instance found:", instance.id);

    // UAZapi endpoint for sending messages - Evolution API v2 format
    const apiUrl = `${instance.api_url}/message/sendText`;
    const payload = {
      number: formattedPhone,
      textMessage: {
        text: message
      }
    };

    console.log("Sending to UAZapi:", { url: apiUrl, number: formattedPhone, payload });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "apikey": instance.token,
      },
      body: JSON.stringify(payload),
    });

    console.log("UAZapi response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("UAZapi error response:", errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        throw new Error(`UAZapi error: ${response.statusText} - ${errorText}`);
      }
      throw new Error(`UAZapi error: ${errorData.message || response.statusText}`);
    }

    let responseData;
    try {
      const responseText = await response.text();
      console.log("UAZapi raw response:", responseText);
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.log("UAZapi returned non-JSON response, using empty object");
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
