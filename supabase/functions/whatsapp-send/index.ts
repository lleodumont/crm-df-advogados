import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const META_API_VERSION = "v18.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface TemplateComponent {
  type: string;
  parameters?: { type: string; text?: string }[];
}

interface SendMessageRequest {
  instanceId: string;
  phoneNumber: string;
  message: string;
  leadId?: string;
  mediaType?: "image" | "audio" | "video" | "document";
  mediaUrl?: string;
  mediaFilename?: string;
  mediaMimeType?: string;
  mediaCaption?: string;
  // Template fields
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: TemplateComponent[];
}

// Upload de mídia para Meta e retorna mediaId
async function uploadMediaToMeta(
  phoneNumberId: string,
  accessToken: string,
  mediaUrl: string,
  mimeType: string,
  filename: string
): Promise<string> {
  const fileRes = await fetch(mediaUrl);
  if (!fileRes.ok) throw new Error(`Falha ao baixar mídia: ${fileRes.statusText}`);
  const fileBlob = await fileRes.blob();

  const form = new FormData();
  form.append("file", fileBlob, filename);
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);

  const uploadRes = await fetch(`${META_API_BASE}/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Falha ao fazer upload de mídia para Meta: ${err}`);
  }

  const { id } = await uploadRes.json();
  if (!id) throw new Error("Meta não retornou mediaId após upload");
  return id;
}

// Monta o payload de mensagem para Meta Graph API
function buildMetaPayload(
  phone: string,
  mediaType: string | undefined,
  mediaId: string | undefined,
  message: string,
  mediaFilename?: string,
  mediaCaption?: string
): Record<string, unknown> {
  if (!mediaType || !mediaId) {
    return {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: message },
    };
  }

  if (mediaType === "audio") {
    return {
      messaging_product: "whatsapp",
      to: phone,
      type: "audio",
      audio: { id: mediaId },
    };
  }

  if (mediaType === "image") {
    return {
      messaging_product: "whatsapp",
      to: phone,
      type: "image",
      image: { id: mediaId, ...(mediaCaption ? { caption: mediaCaption } : {}) },
    };
  }

  if (mediaType === "video") {
    return {
      messaging_product: "whatsapp",
      to: phone,
      type: "video",
      video: { id: mediaId, ...(mediaCaption ? { caption: mediaCaption } : {}) },
    };
  }

  if (mediaType === "document") {
    return {
      messaging_product: "whatsapp",
      to: phone,
      type: "document",
      document: {
        id: mediaId,
        ...(mediaFilename ? { filename: mediaFilename } : {}),
        ...(mediaCaption ? { caption: mediaCaption } : {}),
      },
    };
  }

  throw new Error(`Tipo de mídia não suportado: ${mediaType}`);
}

// Envia mensagem via UazAPI (texto ou mídia)
async function sendViaUazapi(
  apiUrl: string,
  token: string,
  phone: string,
  mediaType: string | undefined,
  mediaUrl: string | undefined,
  message: string,
  mediaFilename?: string,
  mediaMimeType?: string,
  mediaCaption?: string,
): Promise<string | undefined> {
  const headers = {
    "Content-Type": "application/json",
    "token": token,
  };

  if (!mediaType || !mediaUrl) {
    const res = await fetch(`${apiUrl}/send/text`, {
      method: "POST",
      headers,
      body: JSON.stringify({ number: phone, text: message }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`UazAPI text error: ${err}`);
    }
    const data = await res.json();
    return data?.id ?? data?.messageId ?? undefined;
  }

  const body: Record<string, unknown> = {
    number: phone,
    type: mediaType,
    file: mediaUrl,
    ...(mediaCaption ? { text: mediaCaption } : {}),
    ...(mediaFilename ? { docName: mediaFilename } : {}),
    ...(mediaMimeType ? { mimetype: mediaMimeType } : {}),
  };

  const res = await fetch(`${apiUrl}/send/media`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`UazAPI media error: ${err}`);
  }
  const data = await res.json();
  return data?.id ?? data?.messageId ?? undefined;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const defaultPhoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const defaultAccessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      instanceId,
      phoneNumber,
      message,
      leadId,
      mediaType,
      mediaUrl,
      mediaFilename,
      mediaMimeType,
      mediaCaption,
      templateName,
      templateLanguage,
      templateComponents,
    }: SendMessageRequest = await req.json();

    const isMediaMessage = !!mediaType;
    const isTemplateMessage = !!templateName;

    if (!instanceId || !phoneNumber) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: instanceId, phoneNumber" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isMediaMessage && !isTemplateMessage && !message) {
      return new Response(
        JSON.stringify({ error: "Missing required field: message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isMediaMessage && !mediaUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required field: mediaUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id, provider, phone_number_id, access_token, api_url, uazapi_token")
      .eq("instance_id", instanceId)
      .single();

    if (instanceError || !instance) {
      throw new Error("WhatsApp instance not found");
    }

    const provider = instance.provider ?? "meta";

    // ─── UazAPI ───────────────────────────────────────────────────────────────
    if (provider === "uazapi") {
      if (isTemplateMessage) {
        return new Response(
          JSON.stringify({ error: "Templates não são suportados pelo provedor UazAPI" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.api_url || !instance.uazapi_token) {
        throw new Error("Credenciais UazAPI não configuradas (api_url e uazapi_token obrigatórios)");
      }

      const msgType = isMediaMessage ? mediaType! : "text";
      const msgContent = isMediaMessage
        ? (mediaCaption || mediaFilename || mediaType || "media")
        : message;

      let externalId: string | undefined;
      let failed = false;
      let errMessage = "";

      try {
        externalId = await sendViaUazapi(
          instance.api_url,
          instance.uazapi_token,
          formattedPhone,
          isMediaMessage ? mediaType : undefined,
          mediaUrl,
          message,
          mediaFilename,
          mediaMimeType,
          mediaCaption,
        );
        console.log("UazAPI send ok, id:", externalId);
      } catch (e) {
        failed = true;
        errMessage = (e as Error).message;
        console.error("UazAPI send error:", errMessage);
      }

      const { data: savedMessage, error: saveError } = await supabase
        .from("whatsapp_messages")
        .insert({
          instance_id: instance.id,
          lead_id: leadId || null,
          phone_number: formattedPhone,
          message_type: msgType,
          content: msgContent,
          media_url: isMediaMessage ? (mediaUrl || null) : null,
          direction: "outbound",
          status: failed ? "failed" : "sent",
          external_id: externalId || null,
          sent_by: userId,
          ...(failed ? { error: errMessage } : {}),
        })
        .select()
        .single();

      if (saveError) throw saveError;

      return new Response(
        JSON.stringify({ success: !failed, message: savedMessage, ...(failed ? { error: errMessage } : {}) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Meta Cloud API ───────────────────────────────────────────────────────
    const phoneNumberId = instance.phone_number_id || defaultPhoneNumberId;
    const accessToken = instance.access_token || defaultAccessToken;

    if (!phoneNumberId || !accessToken) {
      throw new Error(
        "Credenciais da Meta não configuradas. Configure Phone Number ID e Access Token na instância."
      );
    }

    let mediaId: string | undefined;
    if (isMediaMessage && mediaUrl) {
      const filename = mediaFilename || `media.${(mediaMimeType || "").split("/")[1] || "bin"}`;
      const mimeType = mediaMimeType || "application/octet-stream";
      mediaId = await uploadMediaToMeta(phoneNumberId, accessToken, mediaUrl, mimeType, filename);
      console.log("Media uploaded to Meta, mediaId:", mediaId);
    }

    let metaPayload: Record<string, unknown>;
    if (isTemplateMessage) {
      metaPayload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage || "pt_BR" },
          ...(templateComponents && templateComponents.length > 0 ? { components: templateComponents } : {}),
        },
      };
    } else {
      metaPayload = buildMetaPayload(
        formattedPhone,
        isMediaMessage ? mediaType : undefined,
        mediaId,
        message,
        mediaFilename,
        mediaCaption
      );
    }

    const msgType = isTemplateMessage ? "template" : (isMediaMessage ? mediaType! : "text");
    const msgContent = isTemplateMessage
      ? (message || templateName || "template")
      : (isMediaMessage ? (mediaCaption || mediaFilename || mediaType || "media") : message);

    console.log("Sending to Meta Graph API:", { phone: formattedPhone, type: msgType });

    const metaRes = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaPayload),
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error("Meta API error:", errText);
      let errJson: { error?: { message?: string } } = {};
      try { errJson = JSON.parse(errText); } catch { /* ignore */ }
      const errMessage = errJson.error?.message || `Meta API error: ${metaRes.statusText}`;

      const { data: failedMessage } = await supabase
        .from("whatsapp_messages")
        .insert({
          instance_id: instance.id,
          lead_id: leadId || null,
          phone_number: formattedPhone,
          message_type: msgType,
          content: msgContent,
          media_url: isMediaMessage ? (mediaUrl || null) : null,
          direction: "outbound",
          status: "failed",
          external_id: null,
          sent_by: userId,
          error: errMessage,
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ success: false, error: errMessage, message: failedMessage }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metaData = await metaRes.json();
    const externalId = metaData.messages?.[0]?.id;
    console.log("Meta API response, message id:", externalId);

    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        instance_id: instance.id,
        lead_id: leadId || null,
        phone_number: formattedPhone,
        message_type: msgType,
        content: msgContent,
        media_url: isMediaMessage ? (mediaUrl || null) : null,
        direction: "outbound",
        status: "sent",
        external_id: externalId || null,
        sent_by: userId,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return new Response(
      JSON.stringify({ success: true, message: savedMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
