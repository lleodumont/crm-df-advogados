import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MEDIA_BUCKET = "whatsapp-media";
const META_BASE = "https://graph.facebook.com/v22.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function normalizePhone(raw: string): string {
  const clean = raw.replace("@s.whatsapp.net", "").replace(/\D/g, "");
  return clean.startsWith("55") ? clean : `55${clean}`;
}

async function uploadMediaToStorage(
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
    if (error) { console.error("Storage upload error:", error); return null; }
    const { data: { publicUrl } } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filename);
    return publicUrl;
  } catch (e) {
    console.error("Upload error:", e);
    return null;
  }
}

async function downloadMetaMedia(
  mediaId: string,
  accessToken: string
): Promise<{ bytes: Uint8Array; mimetype: string } | null> {
  try {
    const metaRes = await fetch(`${META_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) { console.error("Meta media info failed:", await metaRes.text()); return null; }
    const { url, mime_type } = await metaRes.json();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const dlRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      if (!dlRes.ok) { console.error("Media download failed:", dlRes.status); return null; }
      const buf = await dlRes.arrayBuffer();
      return { bytes: new Uint8Array(buf), mimetype: mime_type || "application/octet-stream" };
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    console.error("downloadMetaMedia error:", e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
  const webhookSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
  const fallbackAccessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";;

  // ── GET: Meta webhook verification ──────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: inbound messages ───────────────────────────────────────────────────
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const rawBody = await req.text();

  // Validate HMAC signature if secret is configured
  if (webhookSecret) {
    const signature = req.headers.get("x-hub-signature-256") ?? "";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const expected = "sha256=" + Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (signature !== expected) {
      console.error("Invalid webhook signature");
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
    console.log("Webhook payload:", JSON.stringify(payload));

    // Resolve access token: prefer instance-specific token from DB, fall back to env var
    const phoneNumberIdFromPayload: string | undefined =
      payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    // Só processar mensagens do número principal configurado
    const allowedPhoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    if (allowedPhoneNumberId && phoneNumberIdFromPayload && phoneNumberIdFromPayload !== allowedPhoneNumberId) {
      console.log(`Ignoring message for phone_number_id ${phoneNumberIdFromPayload} (allowed: ${allowedPhoneNumberId})`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = fallbackAccessToken;
    if (phoneNumberIdFromPayload) {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("access_token")
        .eq("phone_number_id", phoneNumberIdFromPayload)
        .maybeSingle();
      if (instance?.access_token) accessToken = instance.access_token;
    }

    const changes = payload?.entry?.[0]?.changes ?? [];

    for (const change of changes) {
      const value = change?.value ?? {};
      const messages: any[] = value.messages ?? [];
      const contacts: any[] = value.contacts ?? [];
      const statuses: any[] = value.statuses ?? [];

      // ── Status updates (delivered / read) ────────────────────────────────
      for (const s of statuses) {
        if (!s.id) continue;
        const newStatus = s.status === "read" ? "read"
          : s.status === "delivered" ? "delivered"
          : null;
        if (!newStatus) continue;
        await supabase
          .from("whatsapp_messages")
          .update({ status: newStatus })
          .eq("external_id", s.id);
      }

      // ── Inbound messages ─────────────────────────────────────────────────
      for (const msg of messages) {
        const wamid: string = msg.id;
        const fromRaw: string = msg.from ?? "";
        const cleanPhone = normalizePhone(fromRaw);

        let messageType = "text";
        let content = "";
        let mediaUrl: string | null = null;
        let downloadFailed = false;

        const rawType: string = (msg.type ?? "text").toLowerCase();

        if (rawType === "text") {
          messageType = "text";
          content = msg.text?.body ?? "";

        } else if (["image", "video", "document", "audio", "voice"].includes(rawType)) {
          messageType = rawType === "voice" ? "audio" : rawType;
          const mediaObj = msg[rawType] ?? {};
          const mediaId: string = mediaObj.id ?? "";
          content = mediaObj.caption ?? mediaObj.filename ?? messageType;

          if (mediaId) {
            const downloaded = await downloadMetaMedia(mediaId, accessToken);
            if (downloaded) {
              const ext = downloaded.mimetype.split("/")[1]?.split(";")[0] || "bin";
              const fname = `meta/${wamid}.${ext}`;
              mediaUrl = await uploadMediaToStorage(supabase, downloaded.bytes, downloaded.mimetype, fname);
            }
            if (!mediaUrl) downloadFailed = true;
          }

        } else {
          messageType = "text";
          content = `[${rawType} message]`;
        }

        // Upsert garante que não haverá lead duplicado mesmo com chamadas paralelas
        const contactName = contacts.find((c: any) => c.wa_id === fromRaw || normalizePhone(c.wa_id) === cleanPhone)?.profile?.name ?? cleanPhone;
        const { data: upsertedLead } = await supabase
          .from("leads")
          .upsert(
            { full_name: contactName, phone: cleanPhone, source: "whatsapp", status: "novo" },
            { onConflict: "phone", ignoreDuplicates: true }
          )
          .select("id")
          .maybeSingle();

        // Se não retornou (lead já existia), busca pelo telefone
        let lead = upsertedLead;
        if (!lead) {
          const { data: existing } = await supabase
            .from("leads")
            .select("id")
            .eq("phone", cleanPhone)
            .maybeSingle();
          lead = existing;
        }

        await supabase
          .from("whatsapp_messages")
          .upsert(
            {
              instance_id: null,
              lead_id: lead?.id ?? null,
              phone_number: cleanPhone,
              message_type: messageType,
              content: content || "Unsupported message type",
              media_url: mediaUrl,
              direction: "inbound",
              status: downloadFailed ? "failed" : "pending",
              error: downloadFailed ? "media_download_failed" : null,
              external_id: wamid,
            },
            { onConflict: "external_id", ignoreDuplicates: true }
          );

        // Fire-and-forget: chama o agente de IA para processar a mensagem
        // Não aguardamos a resposta para retornar 200 à Meta rapidamente
        if (!downloadFailed && content) {
          const agentUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-conversation-agent`;
          fetch(agentUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              message_id: wamid,
              phone: cleanPhone,
              lead_id: lead?.id ?? null,
              content,
              message_type: messageType,
              media_url: mediaUrl,
            }),
          }).catch((e) => console.error("ai-agent call failed:", e));
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Webhook processing error:", err);
    // Always return 200 to Meta to prevent redelivery storms
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
