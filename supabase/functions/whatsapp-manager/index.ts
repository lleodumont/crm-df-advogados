DDimport "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const META_API_VERSION = "v18.0";

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

  // Aceita phone_number_id e access_token via query params (por instância)
  // ou fallback para variáveis de ambiente globais
  const url = new URL(req.url);
  const phoneNumberId =
    url.searchParams.get("phone_number_id") || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken =
    url.searchParams.get("access_token") || Deno.env.get("WHATSAPP_ACCESS_TOKEN");

  if (!phoneNumberId || !accessToken) {
    return new Response(
      JSON.stringify({ status: "error", error: "missing_config" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = await metaRes.json();

    if (!metaRes.ok || data.error) {
      console.error("Meta API error:", data.error);
      return new Response(
        JSON.stringify({ status: "error", error: "invalid_token", detail: data.error?.message }),
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
