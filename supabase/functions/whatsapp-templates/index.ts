import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const META_API_VERSION = "v18.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");

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

    // Busca a primeira instância Meta com waba_id
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("waba_id, access_token")
      .not("waba_id", "is", null)
      .not("access_token", "is", null)
      .limit(1)
      .single();

    const wabaId = instance?.waba_id || Deno.env.get("WHATSAPP_WABA_ID");
    const accessToken = instance?.access_token || Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    if (!wabaId || !accessToken) {
      return new Response(
        JSON.stringify({ error: "WABA ID e Access Token não configurados na instância." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
      // Lista templates
      const url = new URL(req.url);
      const status = url.searchParams.get("status") || "";
      const fields = "name,status,category,language,components,rejected_reason,quality_score";
      const metaUrl = `${META_API_BASE}/${wabaId}/message_templates?fields=${fields}&limit=100${status ? `&status=${status}` : ""}`;

      const metaRes = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const metaData = await metaRes.json();

      if (!metaRes.ok) {
        return new Response(JSON.stringify({ error: metaData.error?.message || "Meta API error" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ templates: metaData.data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { name, category, language, components } = body;

      if (!name || !category || !language || !components) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios: name, category, language, components" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const metaRes = await fetch(`${META_API_BASE}/${wabaId}/message_templates`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, category, language, components }),
      });

      const metaData = await metaRes.json();

      if (!metaRes.ok) {
        return new Response(JSON.stringify({ error: metaData.error?.message || "Meta API error" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ template: metaData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const body = await req.json();
      const { name } = body;

      if (!name) {
        return new Response(JSON.stringify({ error: "name é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const metaRes = await fetch(`${META_API_BASE}/${wabaId}/message_templates?name=${name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const metaData = await metaRes.json();

      if (!metaRes.ok) {
        return new Response(JSON.stringify({ error: metaData.error?.message || "Meta API error" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in whatsapp-templates:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
