import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function cleanPhone(raw: string): string {
  return (raw || "").replace(/\D/g, "").slice(-11);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl      = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let data: Record<string, string> = {};
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      data = await req.json();
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      for (const [k, v] of params.entries()) data[k] = v;
    }
    console.log("Eduzz postback:", JSON.stringify(data));

    const pedStatus = String(data.ped_status ?? data.status ?? "");
    if (pedStatus !== "3" && pedStatus !== "approved") {
      return new Response(
        JSON.stringify({ success: true, ignored: true, status: pedStatus }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transactionId = data.trans_cod ?? data.transaction_id ?? data.cod_ped ?? "";
    if (!transactionId) {
      return new Response(JSON.stringify({ error: "Missing trans_cod" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const buyerPhone = cleanPhone(data.cli_cel ?? data.buyer_phone ?? "");

    let leadId: string | null = null;
    if (buyerPhone.length >= 9) {
      const suffix = buyerPhone.slice(-9);
      const { data: lead } = await supabase
        .from("leads")
        .select("id, utm_campaign, campaign_id")
        .ilike("phone", `%${suffix}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lead) {
        leadId = lead.id;
        if (!data.utm_campaign && lead.utm_campaign) data.utm_campaign = lead.utm_campaign;
      }
    }

    const { error } = await supabase
      .from("eduzz_sales")
      .upsert(
        {
          eduzz_transaction_id: transactionId,
          product_id:   data.prod_cod   ?? null,
          product_name: data.prod_nome  ?? data.product_name ?? null,
          buyer_name:   data.cli_nome   ?? data.buyer_name   ?? null,
          buyer_email:  data.cli_email  ?? data.buyer_email  ?? null,
          buyer_phone:  buyerPhone      || null,
          amount:       parseFloat(data.ped_valor ?? data.amount ?? "0") || 0,
          status:       "approved",
          utm_campaign: data.utm_campaign ?? null,
          utm_source:   data.utm_source   ?? null,
          utm_medium:   data.utm_medium   ?? null,
          utm_content:  data.utm_content  ?? null,
          lead_id:      leadId,
          raw_payload:  data,
        },
        { onConflict: "eduzz_transaction_id" }
      );

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, leadId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("eduzz-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
