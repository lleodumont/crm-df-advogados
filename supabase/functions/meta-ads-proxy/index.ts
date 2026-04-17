import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const BASE = "https://graph.facebook.com/v25.0";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

function defaultSince(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function defaultUntil(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const token   = Deno.env.get("META_ACCESS_TOKEN")!;
    const account = Deno.env.get("META_AD_ACCOUNT")!;
    const supabaseUrl      = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!token || !account) throw new Error("META_ACCESS_TOKEN or META_AD_ACCOUNT not configured");

    const url   = new URL(req.url);
    const level = url.searchParams.get("level") ?? "campaign";
    const since = url.searchParams.get("since") ?? defaultSince();
    const until = url.searchParams.get("until") ?? defaultUntil();

    const cacheKey = `${account}_${level}_${since}_${until}`;

    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Checar cache
    const { data: cached } = await supabase
      .from("meta_ads_cache")
      .select("data, fetched_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
        });
      }
    }

    // Buscar na Meta Graph API
    const fields =
      level === "campaign"
        ? "campaign_id,campaign_name,impressions,clicks,spend,reach,cpc,cpm,ctr,frequency"
        : level === "adset"
        ? "campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,reach,cpc,cpm,ctr"
        : "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,spend,cpc,cpm,ctr";

    const params = new URLSearchParams({
      fields,
      level,
      time_range: JSON.stringify({ since, until }),
      limit: "100",
      access_token: token,
    });

    const metaRes = await fetch(`${BASE}/${account}/insights?${params}`);
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error("Meta API error:", errText);
      // Se cache stale existe, melhor retornar ele do que erro
      if (cached) {
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "STALE" },
        });
      }
      throw new Error(`Meta API ${metaRes.status}: ${errText}`);
    }

    const metaData = await metaRes.json();

    // Salvar no cache
    await supabase
      .from("meta_ads_cache")
      .upsert(
        { cache_key: cacheKey, data: metaData, fetched_at: new Date().toISOString() },
        { onConflict: "cache_key" }
      );

    return new Response(JSON.stringify(metaData), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (err) {
    console.error("meta-ads-proxy error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
