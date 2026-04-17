import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MEDIA_BUCKET = "whatsapp-media";

// HKDF info strings por tipo de mídia (padrão WhatsApp)
const WA_MEDIA_KEYS: Record<string, string> = {
  image: "WhatsApp Image Keys",
  video: "WhatsApp Video Keys",
  audio: "WhatsApp Audio Keys",
  document: "WhatsApp Document Keys",
  sticker: "WhatsApp Image Keys",
};

async function decryptWhatsAppMedia(
  encUrl: string,
  mediaKeyB64: string,
  mediaType: string
): Promise<Uint8Array | null> {
  try {
    const infoStr = WA_MEDIA_KEYS[mediaType] ?? "WhatsApp Image Keys";
    const mediaKeyBytes = Uint8Array.from(atob(mediaKeyB64), (c) => c.charCodeAt(0));

    const baseKey = await crypto.subtle.importKey(
      "raw",
      mediaKeyBytes,
      { name: "HKDF" },
      false,
      ["deriveBits"]
    );

    const derived = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(32),
        info: new TextEncoder().encode(infoStr),
      },
      baseKey,
      112 * 8
    );

    const derivedBytes = new Uint8Array(derived);
    const iv = derivedBytes.slice(0, 16);
    const cipherKey = derivedBytes.slice(16, 48);

    const encResp = await fetch(encUrl);
    if (!encResp.ok) {
      console.error("Failed to fetch encrypted media:", encResp.status);
      return null;
    }
    const encData = new Uint8Array(await encResp.arrayBuffer());

    // Remove último 10 bytes (MAC truncado)
    const ciphertext = encData.slice(0, encData.length - 10);

    const aesKey = await crypto.subtle.importKey(
      "raw",
      cipherKey,
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv },
      aesKey,
      ciphertext
    );

    return new Uint8Array(decrypted);
  } catch (e) {
    console.error("WhatsApp media decryption error:", e);
    return null;
  }
}

async function uploadBytesToStorage(
  supabase: any,
  bytes: Uint8Array,
  mimetype: string,
  filename: string
): Promise<string | null> {
  try {
    await supabase.storage.createBucket(MEDIA_BUCKET, { public: true }).catch(() => {});

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

async function uploadBase64ToStorage(
  supabase: any,
  base64: string,
  mimetype: string,
  filename: string
): Promise<string | null> {
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return uploadBytesToStorage(supabase, bytes, mimetype, filename);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const rawBody = await req.json();

    // Formato UazAPI: { instanceName, message: { sender_pn, messageid, type, messageType, content, isGroup }, chat }
    const msg = rawBody.message ?? {};

    // Ignorar mensagens de grupo
    if (msg.isGroup || rawBody.chat?.wa_isGroup) {
      return new Response(
        JSON.stringify({ success: true, message: "Group message ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawPhone = msg.sender_pn ?? msg.sender ?? msg.chatid ?? rawBody.chat?.wa_chatid ?? "";
    // content é onde UazAPI coloca os dados de mídia — tem URL (maiúsculo), mediaKey, mimetype
    const msgContent = msg.content ?? {};

    const anyBase64 = msg.base64 ?? msgContent.base64 ?? rawBody.base64
      ?? msg.media?.base64 ?? msgContent.media?.base64;

    const anyMimetype = msg.mimetype ?? msgContent.mimetype ?? rawBody.mimetype;

    const anyMessageId = msg.messageid ?? msg.messageId ?? msg.id
      ?? rawBody.messageId ?? rawBody.messageid ?? "";

    // URL cifrada do WhatsApp — campo "URL" maiúsculo no msgContent (UazAPI)
    const encryptedUrl: string | null = msgContent.URL ?? msgContent.url ?? null;
    const mediaKey: string | null = msgContent.mediaKey ?? null;

    const instanceId = rawBody.instanceName ?? rawBody.instanceId ?? rawBody.instance ?? "";
    const phone = rawPhone.replace(/@s\.whatsapp\.net$/, "").replace(/@.*$/, "").replace(/\D/g, "");

    // msg.type = "media" (genérico) | msg.messageType = "AudioMessage", "ImageMessage", etc.
    const rawType = (msg.type ?? msg.messageType ?? "").toLowerCase();
    const msgTypeField = (msg.messageType ?? "").toLowerCase(); // "audiomessage", "imagemessage"...
    const mimeLower = (anyMimetype || "").toLowerCase();
    const mediaTypeField = (msg.mediaType ?? "").toLowerCase(); // "ptt", "image", etc.
    const fromMe = msg.fromMe ?? msg.wasSentByApi ?? false;

    if (fromMe) {
      return new Response(
        JSON.stringify({ success: true, message: "Message from self, ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, token, api_url")
      .eq("instance_id", instanceId)
      .maybeSingle();

    if (!instance) {
      console.error("Instance not found:", instanceId);
      return new Response(
        JSON.stringify({ success: false, error: "Instance not found", receivedInstanceId: instanceId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "");

    let messageType = "text";
    let content = "";
    let mediaUrl: string | null = null;

    const isMediaType = rawType === "media"
      || rawType.includes("image") || rawType.includes("video")
      || rawType.includes("audio") || rawType.includes("document")
      || rawType.includes("sticker") || rawType.includes("ptt")
      || msgTypeField.includes("image") || msgTypeField.includes("video")
      || msgTypeField.includes("audio") || msgTypeField.includes("document")
      || msgTypeField.includes("sticker")
      || (rawType === "text" && mimeLower !== "" && !mimeLower.startsWith("text"));

    if (isMediaType) {
      // Determinar tipo a partir de messageType ("AudioMessage"), mediaType ("ptt") ou mimetype
      if (msgTypeField.includes("image") || msgTypeField.includes("sticker")
        || mediaTypeField === "image" || mimeLower.startsWith("image")) {
        messageType = "image";
      } else if (msgTypeField.includes("video") || mediaTypeField === "video"
        || mimeLower.startsWith("video")) {
        messageType = "video";
      } else if (msgTypeField.includes("audio") || mediaTypeField === "ptt"
        || mediaTypeField === "audio" || mimeLower.startsWith("audio")) {
        messageType = "audio";
      } else if (msgTypeField.includes("document") || mediaTypeField === "document") {
        messageType = "document";
      } else if (rawType.includes("image") || rawType.includes("sticker")) {
        messageType = "image";
      } else if (rawType.includes("video")) {
        messageType = "video";
      } else if (rawType.includes("audio") || rawType.includes("ptt")) {
        messageType = "audio";
      } else {
        messageType = "document";
      }

      content = msg.caption ?? msgContent.caption ?? msgContent.fileName ?? msgContent.title ?? messageType;
      const mime = anyMimetype || "application/octet-stream";
      const ext = mime.split("/")[1]?.split(";")[0]?.split("+")[0] || "bin";
      const fname = `${instanceId}/${anyMessageId || Date.now()}.${ext}`;

      // 1. Base64 direto no payload
      if (anyBase64) {
        const uploaded = await uploadBase64ToStorage(supabase, anyBase64, mime, fname);
        if (uploaded) {
          mediaUrl = uploaded;
          console.log("Media from payload base64 uploaded:", mediaUrl);
        }
      }

      // 2. Descriptografia WhatsApp: URL cifrada + mediaKey presentes no content
      if (!mediaUrl && encryptedUrl && mediaKey) {
        console.log("Decrypting WhatsApp media, type:", messageType);
        const decrypted = await decryptWhatsAppMedia(encryptedUrl, mediaKey, messageType);
        if (decrypted) {
          const uploaded = await uploadBytesToStorage(supabase, decrypted, mime, fname);
          if (uploaded) {
            mediaUrl = uploaded;
            console.log("Decrypted media uploaded:", mediaUrl);
          }
        }
      }

      // 3. Tentar endpoint de download do UazAPI
      if (!mediaUrl && instance.token && instance.api_url && anyMessageId) {
        try {
          const dlResp = await fetch(`${instance.api_url}/message/download-media/${anyMessageId}`, {
            headers: { token: instance.token },
          });
          if (dlResp.ok) {
            const dlData = await dlResp.json();
            if (dlData.base64) {
              const dlMime = dlData.mimetype || mime;
              const dlExt = dlMime.split("/")[1]?.split(";")[0]?.split("+")[0] || "bin";
              const dlFname = `${instanceId}/${anyMessageId}.${dlExt}`;
              const uploaded = await uploadBase64ToStorage(supabase, dlData.base64, dlMime, dlFname);
              if (uploaded) {
                mediaUrl = uploaded;
                console.log("UazAPI download uploaded:", mediaUrl);
              }
            }
          }
        } catch (e) {
          console.error("UazAPI download error:", e);
        }
      }

      // 4. Fallback: armazenar URL cifrada (não reproduzível mas registra a mensagem)
      if (!mediaUrl && encryptedUrl) {
        console.log("Fallback: storing encrypted URL (not playable)");
      }

    } else {
      // Mensagem de texto
      content = msg.text ?? msgContent.text ?? "";
      if (!content && typeof msgContent === "object") {
        for (const k of Object.keys(msgContent)) {
          if (msgContent[k]?.text) { content = msgContent[k].text; break; }
        }
      }
    }

    // Busca lead por telefone
    const { data: leads } = await supabase.from("leads").select("id, phone");
    let lead = cleanPhone.length >= 8 ? ((leads || []).find((l: any) => {
      const digits = (l.phone || "").replace(/\D/g, "");
      return digits === cleanPhone
        || digits.endsWith(cleanPhone.slice(-9))
        || cleanPhone.endsWith(digits.slice(-9));
    }) || null) : null;

    const senderName = msg.senderName ?? rawBody.chat?.wa_name ?? rawBody.chat?.name ?? null;

    if (!lead && cleanPhone.length >= 8) {
      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          full_name: senderName || `WhatsApp ${cleanPhone}`,
          phone: cleanPhone,
          status: "novo",
          source: "whatsapp",
        })
        .select("id, phone")
        .single();

      if (!leadError && newLead) {
        lead = newLead;
      } else {
        console.error("Erro ao criar lead:", leadError);
      }
    }

    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        instance_id: instance.id,
        lead_id: lead?.id || null,
        phone_number: cleanPhone,
        message_type: messageType,
        content: content || `[${msg.messageType || msg.type || "mensagem"}]`,
        media_url: mediaUrl,
        direction: "inbound",
        status: "received",
        external_id: anyMessageId || null,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving message:", saveError);
      throw saveError;
    }

    console.log("Message saved:", savedMessage.id, "type:", messageType, "hasMedia:", !!mediaUrl);

    return new Response(
      JSON.stringify({ success: true, messageId: savedMessage.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
