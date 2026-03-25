# WhatsApp Meta API Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three Uazapi-based Edge Functions with Meta Cloud API equivalents, preserving all existing frontend contracts and database schemas.

**Architecture:** Approach A — direct substitution. Each function keeps its name and request/response contract. Internally, all Uazapi HTTP calls are replaced with Meta Graph API calls. The `whatsapp_instances` table is preserved for DB FK compatibility but no longer used for credentials.

**Tech Stack:** Deno (Supabase Edge Functions), Meta WhatsApp Cloud API v22.0, `@supabase/supabase-js@2.57.4`, Supabase Storage

**Spec:** `docs/superpowers/specs/2026-03-25-whatsapp-meta-migration-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/functions/whatsapp-manager/index.ts` | Rewrite | Status endpoint — validates Meta token, returns connection info |
| `supabase/functions/whatsapp-send/index.ts` | Rewrite | Sends text and media via Meta Graph API |
| `supabase/functions/whatsapp-webhook/index.ts` | Rewrite | Receives Meta webhook: GET verification + POST message ingestion |

One new migration file. No frontend changes.

### Schema findings (from migration files)
- `whatsapp_messages.instance_id` — **nullable** (no NOT NULL). Use `null` directly; no shim needed.
- `whatsapp_messages.error` — **does not exist**. Must be added via migration (Task 0).
- `whatsapp_messages.status` CHECK — only allows `('pending', 'sent', 'delivered', 'read', 'failed')`. Use `'pending'` for inbound messages and `'failed'` for all error cases.

---

## Environment Variables

**Add to Supabase secrets (before any deploy):**
- `WHATSAPP_PHONE_NUMBER_ID` — numeric ID from Meta for Developers dashboard
- `WHATSAPP_ACCESS_TOKEN` — System User token from Meta Business Manager
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — any secret string you choose (used once for webhook verification)
- `WHATSAPP_WEBHOOK_SECRET` — another secret string for HMAC signature validation on incoming POSTs

**Remove after all functions are deployed and verified:**
- `UAZAPI_BASE_URL`, `UAZAPI_TOKEN`, `UAZAPI_ADMIN_TOKEN`

---

## Task 0: Database Migration — Add `error` column

**Files:**
- Create: `supabase/migrations/20260325000001_add_error_to_whatsapp_messages.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add error column to whatsapp_messages for tracking send failures
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS error text;
```

- [ ] **Step 2: Apply locally**

```bash
cd "/Users/leonardo/Library/Mobile Documents/com~apple~CloudDocs/Documents/www/Df advogados/crm-df-advogados"
supabase db reset
# or if you want to apply without reset:
supabase migration up
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260325000001_add_error_to_whatsapp_messages.sql
git commit -m "feat(db): add error column to whatsapp_messages"
```

---

## Helper: normalizePhone

Both `whatsapp-send` and `whatsapp-webhook` need phone normalization. Define it inline in each file (two small lines — no shared module needed).

```ts
// E.164 without +, removes @s.whatsapp.net suffix, strips non-digits except leading
function normalizePhone(raw: string): string {
  const clean = raw.replace("@s.whatsapp.net", "").replace(/\D/g, "");
  return clean.startsWith("55") ? clean : `55${clean}`;
}
```

---

## Task 1: whatsapp-manager — Status Endpoint

**Files:**
- Rewrite: `supabase/functions/whatsapp-manager/index.ts`

**Context on existing code:**
Current file has four routes (`/create`, `/connect`, `/status`, `/disconnect`) all talking to Uazapi. All four are deleted. The new file has one route (`GET /status`) that pings Meta.

- [ ] **Step 1: Write the new whatsapp-manager/index.ts**

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

  if (!phoneNumberId || !accessToken) {
    return new Response(
      JSON.stringify({ status: "error", error: "missing_config" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = await metaRes.json();

    if (!metaRes.ok || data.error) {
      console.error("Meta API error:", data.error);
      return new Response(
        JSON.stringify({ status: "error", error: "invalid_token" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "connected",
        phone: data.display_phone_number,
        name: data.verified_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ status: "error", error: "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

- [ ] **Step 2: Serve locally and test**

```bash
cd "/Users/leonardo/Library/Mobile Documents/com~apple~CloudDocs/Documents/www/Df advogados/crm-df-advogados"
supabase functions serve whatsapp-manager --env-file supabase/.env.local
```

In another terminal:
```bash
# With valid token — should return { status: "connected", phone: "...", name: "..." }
curl -s http://localhost:54321/functions/v1/whatsapp-manager \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>"

# Without secrets set — should return { status: "error", error: "missing_config" }
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/whatsapp-manager/index.ts
git commit -m "feat(whatsapp): replace manager with Meta API status endpoint"
```

---

## Task 2: whatsapp-webhook — Verification + Message Ingestion

**Files:**
- Rewrite: `supabase/functions/whatsapp-webhook/index.ts`

**Context on existing code:**
Current file: 267 lines. Has `downloadMediaFromUazapi` (deleted), `uploadMediaToStorage` (kept almost verbatim — good utility), and a complex Uazapi payload parser (replaced by Meta parser). The `upsert` on `external_id` is preserved as-is.

**Note on `instance_id`:** Confirmed nullable from migration file — use `null` directly. No shim needed.

**Note on `status` values:** The CHECK constraint allows only `('pending', 'sent', 'delivered', 'read', 'failed')`. Inbound messages use `'pending'`. Media download failure uses `'failed'`.

- [ ] **Step 1: Write the new whatsapp-webhook/index.ts**

```ts
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
    // Step 1: get temporary URL
    const metaRes = await fetch(`${META_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) { console.error("Meta media info failed:", await metaRes.text()); return null; }
    const { url, mime_type } = await metaRes.json();

    // Step 2: download with 10s timeout
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
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;

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

  // Validate HMAC signature
  const rawBody = await req.text();
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
    const expected = "sha256=" + Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
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

    // Meta sends entry[].changes[].value
    const changes = payload?.entry?.[0]?.changes ?? [];

    for (const change of changes) {
      const value = change?.value ?? {};
      const messages: any[] = value.messages ?? [];
      const contacts: any[] = value.contacts ?? [];
      const statuses: any[] = value.statuses ?? [];

      // ── Status updates (delivered / read) ────────────────────────────────
      for (const s of statuses) {
        if (!s.id) continue;
        const newStatus = s.status === "read" ? "read" : s.status === "delivered" ? "delivered" : null;
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
        const contactName = contacts.find((c: any) => c.wa_id === msg.from)?.profile?.name ?? null;

        let messageType = "text";
        let content = "";
        let mediaUrl: string | null = null;

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
          }
          // If download failed, mediaUrl stays null — message is still saved

        } else {
          messageType = "text";
          content = `[${rawType} message]`;
        }

        // Match lead by phone
        const { data: lead } = await supabase
          .from("leads")
          .select("id")
          .eq("phone", cleanPhone)
          .maybeSingle();

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
              status: mediaUrl === null && ["image","video","audio","document"].includes(messageType)
                ? "failed"
                : "pending",
              error: mediaUrl === null && ["image","video","audio","document"].includes(messageType)
                ? "media_download_failed"
                : null,
              external_id: wamid,
            },
            { onConflict: "external_id", ignoreDuplicates: true }
          );
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
```

- [ ] **Step 3: Serve locally and test GET verification**

```bash
supabase functions serve whatsapp-webhook --env-file supabase/.env.local

# Should return the challenge value:
curl -s "http://localhost:54321/functions/v1/whatsapp-webhook\
?hub.mode=subscribe\
&hub.verify_token=<YOUR_VERIFY_TOKEN>\
&hub.challenge=test123"
# Expected: test123

# Wrong token — should return 403:
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:54321/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x"
# Expected: 403
```

- [ ] **Step 5: Test POST with a simulated Meta payload**

```bash
curl -s -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "id": "wamid.test001",
            "from": "5511999990001",
            "type": "text",
            "text": { "body": "Olá, tudo bem?" }
          }],
          "contacts": [{ "wa_id": "5511999990001", "profile": { "name": "Teste" } }]
        }
      }]
    }]
  }'
# Expected: { "success": true }
# Check Supabase whatsapp_messages table for the saved row
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/whatsapp-webhook/index.ts
git commit -m "feat(whatsapp): replace webhook with Meta Cloud API handler"
```

---

## Task 3: whatsapp-send — Text and Media via Meta

**Files:**
- Rewrite: `supabase/functions/whatsapp-send/index.ts`

**Context on existing code:**
Current file: 242 lines. Key preserved behaviors: auth validation with user JWT, phone normalization, saving to `whatsapp_messages`. The Uazapi HTTP call block (lines 141–195) is replaced by Meta API calls. The `instance_id` in the DB insert previously came from `instance.id` (looked up from `whatsapp_instances`). New strategy: look up first row from `whatsapp_instances` as shim, same as webhook (or null if nullable).

**Note on file sizes:** Meta limits — image: 5MB, video: 16MB, audio: 16MB, document: 100MB. Validate before upload.

- [ ] **Step 1: Write the new whatsapp-send/index.ts**

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const META_BASE = "https://graph.facebook.com/v22.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FILE_SIZE_LIMITS: Record<string, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

function normalizePhone(raw: string): string {
  const clean = raw.replace("@s.whatsapp.net", "").replace(/\D/g, "");
  return clean.startsWith("55") ? clean : `55${clean}`;
}

// Accepts raw base64 or data URI — returns binary bytes
function base64ToBytes(input: string): Uint8Array {
  const b64 = input.includes(",") ? input.split(",")[1] : input;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function uploadMediaToMeta(
  phoneNumberId: string,
  accessToken: string,
  bytes: Uint8Array,
  mimetype: string
): Promise<string | null> {
  const blob = new Blob([bytes], { type: mimetype });
  const form = new FormData();
  form.append("file", blob, "media");
  form.append("type", mimetype);
  form.append("messaging_product", "whatsapp");

  const res = await fetch(`${META_BASE}/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) {
    console.error("Meta media upload failed:", await res.text());
    return null;
  }

  const data = await res.json();
  return data.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      instanceId,        // optional, ignored — kept for frontend compatibility
      phoneNumber,
      message,
      leadId,
      mediaType,
      mediaBase64,
      mediaUrl,
      mediaFilename,
      mediaMimeType,
      mediaCaption,
    } = await req.json();

    if (!phoneNumber) {
      return new Response(JSON.stringify({ error: "Missing required field: phoneNumber" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMediaMessage = !!mediaType;

    if (!isMediaMessage && !message) {
      return new Response(JSON.stringify({ error: "Missing required field: message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isMediaMessage && !mediaBase64 && !mediaUrl) {
      return new Response(JSON.stringify({ error: "Missing mediaBase64 or mediaUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formattedPhone = normalizePhone(phoneNumber);

    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");

    // Validate user session
    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // instance_id is nullable — pass null (confirmed from schema)

    let metaMessageId: string | undefined;
    let sendError: string | null = null;

    if (isMediaMessage) {
      // File size validation
      let bytes: Uint8Array | null = null;
      if (mediaBase64) {
        bytes = base64ToBytes(mediaBase64);
        const limit = FILE_SIZE_LIMITS[mediaType] ?? 16 * 1024 * 1024;
        if (bytes.length > limit) {
          return new Response(
            JSON.stringify({ error: `File exceeds ${limit / 1024 / 1024}MB limit for ${mediaType}` }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Upload media to Meta
      let uploadedMediaId: string | null = null;
      if (bytes) {
        const mime = mediaMimeType || "application/octet-stream";
        uploadedMediaId = await uploadMediaToMeta(phoneNumberId, accessToken, bytes, mime);
      }

      if (!uploadedMediaId && !mediaUrl) {
        sendError = "upload_failed";
      } else {
        // Build message body
        const mediaBody: Record<string, any> = uploadedMediaId
          ? { id: uploadedMediaId }
          : { link: mediaUrl };

        if (mediaCaption) mediaBody.caption = mediaCaption;
        if (mediaType === "document" && mediaFilename) mediaBody.filename = mediaFilename;

        const metaRes = await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: formattedPhone,
            type: mediaType,
            [mediaType]: mediaBody,
          }),
        });

        const metaData = await metaRes.json();

        if (!metaRes.ok) {
          const code = metaData?.error?.code;
          if (code === 131047) sendError = "outside_window";
          else if (code === 131026) sendError = "invalid_number";
          else { console.error("Meta send error:", metaData); sendError = "unknown"; }
        } else {
          metaMessageId = metaData?.messages?.[0]?.id;
        }
      }

    } else {
      // Text message
      const metaRes = await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "text",
          text: { body: message },
        }),
      });

      const metaData = await metaRes.json();

      if (!metaRes.ok) {
        const code = metaData?.error?.code;
        if (code === 131047) sendError = "outside_window";
        else if (code === 131026) sendError = "invalid_number";
        else { console.error("Meta send error:", metaData); sendError = "unknown"; }
      } else {
        metaMessageId = metaData?.messages?.[0]?.id;
      }
    }

    // Save to DB regardless of success/failure
    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        instance_id: null,
        lead_id: leadId || null,
        phone_number: formattedPhone,
        message_type: isMediaMessage ? mediaType : "text",
        content: isMediaMessage ? (mediaCaption || mediaFilename || mediaType || "media") : message,
        media_url: isMediaMessage ? (mediaUrl || null) : null,
        direction: "outbound",
        status: sendError ? "failed" : "sent",
        error: sendError,
        external_id: metaMessageId,
        sent_by: user.id,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    if (sendError) {
      const httpStatus = sendError === "unknown" ? 500 : 422;
      return new Response(JSON.stringify({ error: sendError }), {
        status: httpStatus,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: savedMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Test text send locally**

```bash
supabase functions serve whatsapp-send --env-file supabase/.env.local

curl -s -X POST http://localhost:54321/functions/v1/whatsapp-send \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "5511999990001",
    "message": "Teste de migração Meta API"
  }'
# Expected: { "success": true, "message": { ... } }
# Check whatsapp_messages table for the row with status: "sent"
```

- [ ] **Step 3: Test outside-window error handling**

Send to a number that has no active 24h session. Expected response: `{ "error": "outside_window" }` with HTTP 422. Check `whatsapp_messages` for the row with `status: "failed"`, `error: "outside_window"`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/whatsapp-send/index.ts
git commit -m "feat(whatsapp): replace send with Meta Cloud API, preserve frontend contract"
```

---

## Task 4: Deploy to Production

- [ ] **Step 1: Add secrets to Supabase**

```bash
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=<value>
supabase secrets set WHATSAPP_ACCESS_TOKEN=<value>
supabase secrets set WHATSAPP_WEBHOOK_VERIFY_TOKEN=<value>
supabase secrets set WHATSAPP_WEBHOOK_SECRET=<value>
```

- [ ] **Step 2: Deploy whatsapp-webhook first**

```bash
supabase functions deploy whatsapp-webhook
```

- [ ] **Step 3: Register webhook in Meta for Developers dashboard**

- Go to Meta for Developers → App → WhatsApp → Configuration → Webhook
- Callback URL: `https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`
- Verify token: the value you set for `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- Click "Verify and Save" — Meta will call the GET endpoint
- Subscribe to: `messages`

- [ ] **Step 4: Deploy whatsapp-send and whatsapp-manager**

```bash
supabase functions deploy whatsapp-send
supabase functions deploy whatsapp-manager
```

- [ ] **Step 5: Verify connection**

```bash
curl -s https://<project-ref>.supabase.co/functions/v1/whatsapp-manager \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>"
# Expected: { "status": "connected", "phone": "...", "name": "..." }
```

- [ ] **Step 6: Send a real test message**

Use the CRM UI to send a text message to a known number. Verify:
- Message appears in the CRM conversation
- `whatsapp_messages` row has `status: "sent"` and a `external_id` (wamid)
- The recipient receives the message on WhatsApp

- [ ] **Step 7: Test inbound message**

Reply from the test WhatsApp number. Verify:
- Message appears in the CRM conversation
- `whatsapp_messages` row has `direction: "inbound"`, `status: "received"`

- [ ] **Step 8: Remove old secrets (only after Step 6 and 7 pass)**

Only run this after confirming both outbound and inbound message flows work end-to-end:

```bash
supabase secrets unset UAZAPI_BASE_URL UAZAPI_TOKEN UAZAPI_ADMIN_TOKEN
```

- [ ] **Step 9: Final commit**

```bash
git add .
git commit -m "feat(whatsapp): complete migration to Meta Cloud API"
```

---

## Rollback Plan

Before starting, tag the current state:
```bash
git tag whatsapp-pre-meta-migration
```

If anything breaks after deploy:
1. `git checkout whatsapp-pre-meta-migration -- supabase/functions/whatsapp-manager/index.ts supabase/functions/whatsapp-send/index.ts supabase/functions/whatsapp-webhook/index.ts`
2. `supabase functions deploy whatsapp-manager whatsapp-send whatsapp-webhook`
3. `supabase secrets set UAZAPI_BASE_URL=<value> UAZAPI_TOKEN=<value> UAZAPI_ADMIN_TOKEN=<value>`

The `whatsapp_instances` table is untouched — the old code can resume immediately. The `error` column migration is additive and does not affect rollback.
