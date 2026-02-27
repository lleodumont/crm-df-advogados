import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UAZAPI_BASE_URL = "https://api.uazapi.com";

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
        throw new Error("Name and instanceId are required");
      }

      const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: userData, error: userError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );

      if (userError) {
        console.error("User auth error:", userError);
        throw new Error("Authentication failed: " + userError.message);
      }

      console.log("User authenticated:", userData.user.id);

      // Check if user is admin or manager
      const { data: userProfile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();

      if (profileError) {
        console.error("Profile error:", profileError);
        throw new Error("Failed to fetch user profile");
      }

      if (!userProfile || !["admin", "manager"].includes(userProfile.role)) {
        throw new Error("Insufficient permissions. Only admins and managers can create WhatsApp instances.");
      }

      console.log("User has permission:", userProfile.role);

      const { data: instance, error: insertError } = await supabase
        .from("whatsapp_instances")
        .insert({
          name,
          instance_id: instanceId,
          status: "disconnected",
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Database error: " + insertError.message);
      }

      console.log("Instance created successfully:", instance.id);

      return new Response(JSON.stringify({ success: true, instance }), {
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
