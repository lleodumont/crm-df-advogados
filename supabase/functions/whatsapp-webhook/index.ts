import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WebhookMessage {
  instanceId: string;
  messageId: string;
  phone: string;
  fromMe: boolean;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: {
      caption?: string;
      url: string;
    };
    videoMessage?: {
      caption?: string;
      url: string;
    };
    documentMessage?: {
      caption?: string;
      url: string;
    };
    audioMessage?: {
      url: string;
    };
  };
  messageType: string;
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

    const webhookData: WebhookMessage = await req.json();

    console.log("Received webhook:", JSON.stringify(webhookData, null, 2));

    if (webhookData.fromMe) {
      return new Response(
        JSON.stringify({ success: true, message: "Message from self, ignored" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("instance_id", webhookData.instanceId)
      .single();

    if (!instance) {
      console.error("Instance not found:", webhookData.instanceId);
      return new Response(
        JSON.stringify({ success: false, error: "Instance not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cleanPhone = webhookData.phone.replace(/\D/g, "");

    let messageType = "text";
    let content = "";
    let mediaUrl = null;

    if (webhookData.message) {
      if (webhookData.message.conversation) {
        content = webhookData.message.conversation;
      } else if (webhookData.message.extendedTextMessage) {
        content = webhookData.message.extendedTextMessage.text;
      } else if (webhookData.message.imageMessage) {
        messageType = "image";
        content = webhookData.message.imageMessage.caption || "Image";
        mediaUrl = webhookData.message.imageMessage.url;
      } else if (webhookData.message.videoMessage) {
        messageType = "video";
        content = webhookData.message.videoMessage.caption || "Video";
        mediaUrl = webhookData.message.videoMessage.url;
      } else if (webhookData.message.documentMessage) {
        messageType = "document";
        content = webhookData.message.documentMessage.caption || "Document";
        mediaUrl = webhookData.message.documentMessage.url;
      } else if (webhookData.message.audioMessage) {
        messageType = "audio";
        content = "Audio message";
        mediaUrl = webhookData.message.audioMessage.url;
      }
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("phone", cleanPhone)
      .maybeSingle();

    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        instance_id: instance.id,
        lead_id: lead?.id || null,
        phone_number: cleanPhone,
        message_type: messageType,
        content: content || "Unsupported message type",
        media_url: mediaUrl,
        direction: "inbound",
        status: "received",
        external_id: webhookData.messageId,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving message:", saveError);
      throw saveError;
    }

    console.log("Message saved successfully:", savedMessage.id);

    return new Response(
      JSON.stringify({ success: true, messageId: savedMessage.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
