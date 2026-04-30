import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MEDIA_BUCKET = "whatsapp-media";

const MESSAGE_TYPE_MAP: Record<string, string> = {
  imagemessage: "image",
  audiomessage: "audio",
  pttmessage: "audio",
  videomessage: "video",
  documentmessage: "document",
};

function normalizePhone(raw: string): string {
  const clean = raw
    .replace("@s.whatsapp.net", "")
    .replace("@c.us", "")
    .replace(/\D/g, "");
  return clean.startsWith("55") ? clean : `55${clean}`;
}

async function uploadMediaToStorage(
  supabase: ReturnType<typeof createClientSync>,
  bytes: Uint8Array,
  mimetype: string,
  filename: string
): Promise<string | null> {
  try {
    await supabase.storage.createBucket(MEDIA_BUCKET, { public: true }).catch(() => {});
    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(filename, bytes, { contentType: mimetype, upsert: true });
    if (error) { console.error("Storage upload error:", error); return null; }
    const { data: { publicUrl } } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filename);
    return publicUrl;
  } catch (e) {
    console.error("uploadMediaToStorage error:", e);
    return null;
  }
}

async function transcribeAudio(bytes: Uint8Array, mimetype: string): Promise<string | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  const ext = mimetype.includes("ogg") ? "ogg"
    : mimetype.includes("mp4") ? "mp4"
    : "mp3";

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimetype }), `audio.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "pt");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text?.trim() || null;
  } catch {
    return null;
  }
}

// workaround para tipagem inline
function createClientSync(url: string, key: string) {
  const { createClient } = require("npm:@supabase/supabase-js@2.57.4");
  return createClient(url, key);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const rawBody = await req.text();

  // Validação opcional por secret header
  const webhookSecret = Deno.env.get("UAZAPI_WEBHOOK_SECRET");
  if (webhookSecret) {
    const incoming = req.headers.get("x-uazapi-secret") ?? "";
    if (incoming !== webhookSecret) {
      console.error("UazAPI webhook: invalid secret");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = JSON.parse(rawBody);
    console.log("UazAPI webhook received, instanceName:", payload?.instanceName);

    const msg = payload?.message;
    if (!msg) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // Ignorar mensagens enviadas pelo próprio número
    if (msg.fromMe === true) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // Ignorar grupos
    if (payload?.chat?.wa_isGroup === true || msg.isGroup === true) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const instanceName: string = payload?.instanceName ?? "";
    const senderPn: string = msg.sender_pn ?? msg.chatid ?? "";
    const cleanPhone = normalizePhone(senderPn);
    const wamid: string = msg.messageid ?? msg.messageId ?? msg.id ?? `uaz-${Date.now()}`;

    // Resolve instância pelo instanceName (deve coincidir com instance_id cadastrado)
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("instance_id", instanceName)
      .eq("provider", "uazapi")
      .maybeSingle();

    // Detecta tipo e conteúdo
    const rawMsgType: string = (msg.messageType ?? msg.type ?? "text").toLowerCase();
    const content = msg.content ?? {};

    let messageType = "text";
    let messageContent = "";
    let mediaUrl: string | null = null;

    if (rawMsgType === "text" || rawMsgType === "conversation") {
      messageType = "text";
      messageContent = content.text ?? msg.body ?? "";

    } else if (MESSAGE_TYPE_MAP[rawMsgType]) {
      messageType = MESSAGE_TYPE_MAP[rawMsgType];
      messageContent = content.text ?? content.caption ?? messageType;

      // Tenta baixar mídia da URL exposta pela UazAPI
      const mediaUrlRaw = content.URL ?? content.url ?? null;
      if (mediaUrlRaw) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          try {
            const dlRes = await fetch(mediaUrlRaw, { signal: controller.signal });
            if (dlRes.ok) {
              const buf = await dlRes.arrayBuffer();
              const bytes = new Uint8Array(buf);
              const mimetype = content.mimetype || "application/octet-stream";
              const ext = mimetype.split("/")[1]?.split(";")[0] || "bin";
              const fname = `uazapi/${wamid}.${ext}`;
              mediaUrl = await uploadMediaToStorage(supabase, bytes, mimetype, fname);

              if (messageType === "audio" && mediaUrl) {
                const transcription = await transcribeAudio(bytes, mimetype);
                if (transcription) messageContent = transcription;
              }
            }
          } finally {
            clearTimeout(timeout);
          }
        } catch (e) {
          console.error("UazAPI media download error:", e);
        }
      }

    } else {
      messageType = "text";
      messageContent = `[${msg.messageType ?? rawMsgType} message]`;
    }

    // Upsert lead pelo telefone normalizado
    const contactName: string = payload?.chat?.wa_name ?? cleanPhone;
    let lead: { id: string } | null = null;

    const { data: upsertedLead } = await supabase
      .from("leads")
      .upsert(
        { full_name: contactName, phone: cleanPhone, source: "whatsapp", status: "novo" },
        { onConflict: "phone", ignoreDuplicates: true }
      )
      .select("id")
      .maybeSingle();

    if (upsertedLead) {
      lead = upsertedLead;
    } else {
      const phoneAlt = cleanPhone.startsWith("55") ? cleanPhone.slice(2) : `55${cleanPhone}`;
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .or(`phone.eq.${cleanPhone},phone.eq.${phoneAlt}`)
        .maybeSingle();
      lead = existing;
    }

    // Salva mensagem (idempotente por external_id)
    const { data: savedMsg } = await supabase
      .from("whatsapp_messages")
      .upsert(
        {
          instance_id: instance?.id ?? null,
          lead_id: lead?.id ?? null,
          phone_number: cleanPhone,
          message_type: messageType,
          content: messageContent || "Mensagem recebida",
          media_url: mediaUrl,
          direction: "inbound",
          status: "pending",
          external_id: wamid,
        },
        { onConflict: "external_id", ignoreDuplicates: true }
      )
      .select()
      .maybeSingle();

    // Fire-and-forget para agente de IA
    if (messageContent && lead?.id) {
      const agentUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-conversation-agent`;
      fetch(agentUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          message_id: savedMsg?.id ?? wamid,
          phone: cleanPhone,
          lead_id: lead.id,
          content: messageContent,
          message_type: messageType,
          media_url: mediaUrl,
        }),
      }).catch((e) => console.error("ai-agent call failed:", e));
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error("UazAPI webhook error:", err);
    // Sempre retorna 200 para a UazAPI não retentar
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
});
