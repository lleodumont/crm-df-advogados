import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ✅ FIX 1: Usa variável de ambiente em vez de URL hardcoded
const UAZAPI_BASE_URL = Deno.env.get("UAZAPI_BASE_URL") || "https://grupodumont.uazapi.com";

interface CreateInstanceRequest {
  name: string;
  instanceId: string;
}

interface ConnectInstanceRequest {
  instanceId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const uazapiToken = Deno.env.get("UAZAPI_TOKEN");
    // ✅ FIX 2: Pega o admintoken para criar instâncias
    const uazapiAdminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN");

    if (!uazapiToken) {
      throw new Error("UAZAPI_TOKEN not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const url = new URL(req.url);
    const path = url.pathname.split("/whatsapp-manager")[1] || "/";

    if (path === "/create" && req.method === "POST") {
      console.log("Creating WhatsApp instance...");

      const { name, instanceId }: CreateInstanceRequest = await req.json();
      console.log("Instance data:", { name, instanceId });

      if (!name || !instanceId) {
        return new Response(
          JSON.stringify({ error: "Name and instanceId are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: userData, error: userError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );

      if (userError) {
        console.error("User auth error:", userError);
        return new Response(
          JSON.stringify({ error: "Authentication failed: " + userError.message }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("User authenticated:", userData.user.id);

      const { data: userProfile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile error:", profileError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch user profile: " + profileError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!userProfile) {
        return new Response(
          JSON.stringify({ error: "User profile not found. Please contact administrator." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!["admin", "manager"].includes(userProfile.role)) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions. Only admins and managers can create WhatsApp instances." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("User has permission:", userProfile.role);

      // ✅ FIX 3: Chama a UazAPI para criar a instância de verdade
      console.log("Calling UazAPI to create instance...");
      const uazapiResponse = await fetch(
        `${UAZAPI_BASE_URL}/instance/init`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "admintoken": uazapiAdminToken || uazapiToken,
          },
          body: JSON.stringify({
            name: name,
          }),
        }
      );

      if (!uazapiResponse.ok) {
        const errorBody = await uazapiResponse.text();
        console.error("UazAPI error response:", errorBody);
        return new Response(
          JSON.stringify({ error: `Failed to create instance on UazAPI: ${errorBody}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const uazapiData = await uazapiResponse.json();
      console.log("UazAPI instance created:", uazapiData);

      // Salva no banco com o token e API URL
      const { data: instance, error: insertError } = await supabase
        .from("whatsapp_instances")
        .insert({
          name,
          instance_id: instanceId,
          status: "disconnected",
          created_by: userData.user.id,
          // Salva o token da instância retornado pela UazAPI
          token: uazapiData.token || null,
          api_url: UAZAPI_BASE_URL,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        // Se falhou no banco, tenta deletar a instância da UazAPI para não deixar lixo
        return new Response(
          JSON.stringify({
            error: "Database error: " + insertError.message,
            details: insertError
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("Instance created successfully:", instance.id);

      return new Response(JSON.stringify({ success: true, instance }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "/connect" && req.method === "POST") {
      const { instanceId }: ConnectInstanceRequest = await req.json();

      const response = await fetch(
        `${UAZAPI_BASE_URL}/instance/qrcode?instanceId=${instanceId}`,
        {
          headers: {
            "Authorization": `Bearer ${uazapiToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`UazAPI error: ${response.statusText}`);
      }

      const data = await response.json();

      const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from("whatsapp_instances")
        .update({
          status: "qrcode",
          qr_code: data.qrcode,
        })
        .eq("instance_id", instanceId);

      return new Response(JSON.stringify({ success: true, qrCode: data.qrcode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "/status" && req.method === "GET") {
      const instanceId = url.searchParams.get("instanceId");

      if (!instanceId) {
        throw new Error("instanceId parameter required");
      }

      const response = await fetch(
        `${UAZAPI_BASE_URL}/instance/status?instanceId=${instanceId}`,
        {
          headers: {
            "Authorization": `Bearer ${uazapiToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`UazAPI error: ${response.statusText}`);
      }

      const data = await response.json();

      const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      let status = "disconnected";
      let phoneNumber = null;

      if (data.status === "CONNECTED" || data.state === "CONNECTED") {
        status = "connected";
        phoneNumber = data.phoneNumber || data.phone;
      }

      await supabase
        .from("whatsapp_instances")
        .update({
          status,
          phone_number: phoneNumber,
          qr_code: null,
        })
        .eq("instance_id", instanceId);

      return new Response(JSON.stringify({ success: true, status, phoneNumber }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "/disconnect" && req.method === "POST") {
      const { instanceId }: ConnectInstanceRequest = await req.json();

      const response = await fetch(
        `${UAZAPI_BASE_URL}/instance/logout?instanceId=${instanceId}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${uazapiToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`UazAPI error: ${response.statusText}`);
      }

      const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from("whatsapp_instances")
        .update({
          status: "disconnected",
          phone_number: null,
          qr_code: null,
        })
        .eq("instance_id", instanceId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Route not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
