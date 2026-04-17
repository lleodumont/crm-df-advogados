import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MEDIA_BUCKET = "whatsapp-media";

interface WebhookMessage {
  instanceId: string;
  messageId: string;
  phone: string;
  fromMe: boolean;
  messageType: string;
  // Base64 pode vir diretamente no payload (algumas versões UazAPI)
  base64?: string;
  mimetype?: string;
  caption?: string;
  filename?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { caption?: string; url?: string; downloadUrl?: string; mediaUrl?: string; mimetype?: string; base64?: string };
    videoMessage?: { caption?: string; url?: string; downloadUrl?: string; mediaUrl?: string; mimetype?: string; base64?: string };
    documentMessage?: { caption?: string; url?: string; downloadUrl?: string; mediaUrl?: string; fileName?: string; title?: string; mimetype?: string; base64?: string };
    audioMessage?: { url?: string; downloadUrl?: string; mediaUrl?: string; mimetype?: string; base64?: string };
    // Formato alternativo UazAPI
    [key: string]: any;
  };
}

async function downloadMediaFromUazapi(
  apiUrl: string,
  token: string,
  messageId: string
): Promise<{ base64: string; mimetype: string } | null> {
  try {
    const response = await fetch(`${apiUrl}/message/download-media/${messageId}`, {
      method: "GET",
      headers: { "token": token, "Accept": "application/json" },
    });
    if (!response.ok) {
      console.log("Media download failed:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    if (data.base64) {
      return { base64: data.base64, mimetype: data.mimetype || "application/octet-stream" };
    }
    return null;
  } catch (e) {
    console.error("Error downloading media from UazAPI:", e);
    return null;
  }
}

async function uploadMediaToStorage(
  supabase: any,
  base64: string,
  mimetype: string,
  filename: string
): Promise<string | null> {
  try {
    // Ensure bucket exists
    await supabase.storage.createBucket(MEDIA_BUCKET, { public: true }).catch(() => {});

    const byteString = atob(base64);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i);
    }

    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(filename, bytes, { contentType: mimetype, upsert: true });

    if (error) {
      console.error("Storage upload error:", error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(MEDIA_BUCKET)
      .getPublicUrl(filename);

    return publicUrl;
  } catch (e) {
    console.error("Upload error:", e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const rawBody = await req.json();
    // Log completo para diagnóstico — remover após confirmar formato do UazAPI
    console.log("Webhook payload completo:", JSON.stringify(rawBody, null, 2));

    // Formato UazAPI: { instanceName, message: { sender_pn, messageid, fromMe, text, content, isGroup }, chat }
    const msg = rawBody.message ?? {};

    // Ignorar mensagens de grupo
    if (msg.isGroup || rawBody.chat?.wa_isGroup) {
      return new Response(
        JSON.stringify({ success: true, message: "Group message ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // sender_pn é sempre no formato @s.whatsapp.net; sender pode ser LID
    const rawPhone = msg.sender_pn ?? msg.sender ?? msg.chatid ?? rawBody.chat?.wa_chatid ?? "";
    const webhookData: WebhookMessage = {
      ...rawBody,
      instanceId: rawBody.instanceName ?? rawBody.instanceId ?? rawBody.instance ?? "",
      messageId: msg.messageid ?? msg.id ?? "",
      phone: rawPhone.replace(/@s\.whatsapp\.net$/, "").replace(/@.*$/, "").replace(/\D/g, ""),
      fromMe: msg.fromMe ?? msg.wasSentByApi ?? false,
      messageType: msg.type ?? msg.messageType ?? "text",
      message: { conversation: msg.text ?? msg.content?.text ?? "" },
    };

    console.log("Campos normalizados:", JSON.stringify({
      instanceId: webhookData.instanceId,
      messageId: webhookData.messageId,
      phone: webhookData.phone,
      fromMe: webhookData.fromMe,
      messageType: webhookData.messageType,
      rawTopLevelKeys: Object.keys(rawBody),
      rawDataKeys: rawBody.data ? Object.keys(rawBody.data) : [],
      rawKeyKeys: (rawBody.data?.key ?? rawBody.key) ? Object.keys(rawBody.data?.key ?? rawBody.key) : [],
    }));

    if (webhookData.fromMe) {
      return new Response(
        JSON.stringify({ success: true, message: "Message from self, ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Busca instância tentando os dois formatos de ID possíveis
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, token, api_url")
      .eq("instance_id", webhookData.instanceId)
      .maybeSingle();

    if (!instance) {
      console.error("Instance not found for instanceId:", webhookData.instanceId, "— verifique se o campo instanceId do UazAPI bate com instance_id na tabela whatsapp_instances");
      return new Response(
        JSON.stringify({ success: false, error: "Instance not found", receivedInstanceId: webhookData.instanceId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = webhookData.phone.replace(/\D/g, "");

    let messageType = "text";
    let content = "";
    let mediaUrl: string | null = null;

    // Usar messageType do payload como fonte primária de detecção
    const rawType = (webhookData.messageType || "").toLowerCase();
    const isMediaType = rawType.includes("image") || rawType.includes("video") || rawType.includes("audio") || rawType.includes("document") || rawType.includes("sticker");

    if (isMediaType) {
      messageType = rawType.includes("image") || rawType.includes("sticker") ? "image"
        : rawType.includes("video") ? "video"
        : rawType.includes("audio") || rawType.includes("ptt") ? "audio"
        : "document";

      const msg = webhookData.message || {};
      const subMsg = msg[webhookData.messageType] || msg.imageMessage || msg.videoMessage || msg.audioMessage || msg.documentMessage || {};

      content = webhookData.caption || subMsg.caption || subMsg.fileName || subMsg.title || messageType;
      const mimetypeHint = webhookData.mimetype || subMsg.mimetype || "";

      // 1. Checar base64 direto no payload ou no sub-objeto
      const directBase64 = webhookData.base64 || subMsg.base64;
      if (directBase64) {
        const mime = mimetypeHint || "application/octet-stream";
        const ext = mime.split("/")[1]?.split(";")[0]?.split("+")[0] || "bin";
        const fname = `${webhookData.instanceId}/${webhookData.messageId}.${ext}`;
        const uploaded = await uploadMediaToStorage(supabase, directBase64, mime, fname);
        if (uploaded) {
          mediaUrl = uploaded;
          console.log(`Media from base64 uploaded: ${mediaUrl}`);
        }
      }

      // 2. Tentar baixar via endpoint UazAPI
      if (!mediaUrl && instance.token && instance.api_url) {
        console.log(`Downloading ${messageType} via UazAPI for messageId: ${webhookData.messageId}`);
        const downloaded = await downloadMediaFromUazapi(instance.api_url, instance.token, webhookData.messageId);
        if (downloaded) {
          const ext = (downloaded.mimetype || mimetypeHint).split("/")[1]?.split(";")[0]?.split("+")[0] || "bin";
          const fname = `${webhookData.instanceId}/${webhookData.messageId}.${ext}`;
          const uploaded = await uploadMediaToStorage(supabase, downloaded.base64, downloaded.mimetype, fname);
          if (uploaded) {
            mediaUrl = uploaded;
            console.log(`Media downloaded and uploaded: ${mediaUrl}`);
          }
        }
      }

      // 3. Fallback: URL direta do payload
      if (!mediaUrl) {
        const subMsgAny = subMsg as any;
        mediaUrl = subMsgAny.downloadUrl || subMsgAny.mediaUrl || subMsgAny.url || null;
        if (mediaUrl) console.log(`Using fallback URL: ${mediaUrl}`);
      }

    } else if (webhookData.message) {
      const msg = webhookData.message;
      if (msg.conversation) {
        content = msg.conversation;
      } else if (msg.extendedTextMessage) {
        content = msg.extendedTextMessage.text;
      } else {
        // Tentar extrair texto de qualquer sub-objeto
        const keys = Object.keys(msg);
        for (const k of keys) {
          if (msg[k]?.text) { content = msg[k].text; break; }
          if (msg[k]?.conversation) { content = msg[k].conversation; break; }
        }
      }
    }

    // Busca por dígitos do telefone — leads podem ter formatação como "(47) 98805-4088"
    const { data: leads } = await supabase
      .from("leads")
      .select("id, phone");

    let lead = cleanPhone.length >= 8 ? ((leads || []).find(l => {
      const digits = (l.phone || "").replace(/\D/g, "");
      return digits === cleanPhone || digits.endsWith(cleanPhone.slice(-9)) || cleanPhone.endsWith(digits.slice(-9));
    }) || null) : null;

    const senderName = rawBody.message?.senderName
      || rawBody.chat?.wa_name
      || rawBody.chat?.name
      || rawBody.message?.groupName
      || null;

    // Criar lead automaticamente se não encontrado
    if (!lead && cleanPhone.length >= 8) {
      const newName = senderName || `WhatsApp ${cleanPhone}`;
      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          full_name: newName,
          phone: cleanPhone,
          status: "novo",
          source: "whatsapp",
        })
        .select("id, phone")
        .single();

      if (!leadError && newLead) {
        lead = newLead;
        console.log("Lead criado automaticamente:", newLead.id);
      } else {
        console.error("Erro ao criar lead:", leadError);
      }
    }

    const externalId = webhookData.messageId || null;

    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        instance_id: instance.id,
        lead_id: lead?.id || null,
        phone_number: cleanPhone,
        message_type: messageType,
        content: content || `[${webhookData.messageType || "mensagem"}]`,
        media_url: mediaUrl,
        direction: "inbound",
        status: "received",
        external_id: externalId,
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
