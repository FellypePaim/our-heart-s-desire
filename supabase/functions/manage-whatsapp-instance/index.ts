import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UAZAPI_ADMIN_TOKEN = () => {
  const t = Deno.env.get("UAZAPI_ADMIN_TOKEN");
  if (!t) throw new Error("UAZAPI_ADMIN_TOKEN não configurado");
  return t;
};

const UAZAPI_BASE = () => {
  const sub = Deno.env.get("UAZAPI_SUBDOMAIN");
  if (!sub) throw new Error("UAZAPI_SUBDOMAIN não configurado");
  return `https://${sub}.uazapi.com`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();
    const baseUrl = UAZAPI_BASE();
    const adminToken = UAZAPI_ADMIN_TOKEN();

    // ---- CREATE INSTANCE ----
    if (action === "create") {
      // Check if user already has an instance
      const { data: existing } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing?.instance_key && existing?.api_token) {
        // Instance already exists, just return status
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Instância já existe",
          instance_key: existing.instance_key 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new instance on UAZAPI
      const instanceName = `brave-${user.id.substring(0, 8)}-${Date.now()}`;
      const createRes = await fetch(`${baseUrl}/instance/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          admintoken: adminToken,
        },
        body: JSON.stringify({
          name: instanceName,
          adminField01: user.id,
          adminField02: "brave-gestor",
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        console.error("UAZAPI create error:", createData);
        return new Response(
          JSON.stringify({ error: "Erro ao criar instância no UAZAPI", details: createData }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save instance token to DB
      const instanceToken = createData.token || createData.instance?.token || "";
      const instanceKey = createData.name || createData.instance?.name || instanceName;

      if (existing) {
        await supabase
          .from("whatsapp_instances")
          .update({ instance_key: instanceKey, api_token: instanceToken })
          .eq("user_id", user.id);
      } else {
        await supabase.from("whatsapp_instances").insert({
          user_id: user.id,
          instance_key: instanceKey,
          api_token: instanceToken,
        });
      }

      return new Response(
        JSON.stringify({ success: true, instance_key: instanceKey, data: createData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- CONNECT (triggers QR code generation) ----
    if (action === "connect") {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_key, api_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!instance?.api_token) {
        return new Response(
          JSON.stringify({ error: "Instância não encontrada. Crie uma primeiro." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const connectRes = await fetch(`${baseUrl}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: instance.api_token,
        },
      });

      const connectData = await connectRes.json();
      return new Response(JSON.stringify({ success: connectRes.ok, data: connectData }), {
        status: connectRes.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- STATUS (get QR code + connection state) ----
    if (action === "status") {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_key, api_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!instance?.api_token) {
        return new Response(
          JSON.stringify({ status: "not_created", message: "Nenhuma instância criada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const statusRes = await fetch(`${baseUrl}/instance/status`, {
        method: "GET",
        headers: { token: instance.api_token },
      });

      const statusData = await statusRes.json();
      return new Response(JSON.stringify({ success: true, data: statusData }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- DISCONNECT ----
    if (action === "disconnect") {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_key, api_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!instance?.api_token) {
        return new Response(
          JSON.stringify({ error: "Instância não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const disconnectRes = await fetch(`${baseUrl}/instance/disconnect`, {
        method: "POST",
        headers: { token: instance.api_token },
      });

      const disconnectData = await disconnectRes.json();
      return new Response(JSON.stringify({ success: disconnectRes.ok, data: disconnectData }), {
        status: disconnectRes.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- DELETE ----
    if (action === "delete") {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_key, api_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!instance?.api_token) {
        return new Response(
          JSON.stringify({ error: "Instância não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete from UAZAPI
      await fetch(`${baseUrl}/instance/delete`, {
        method: "DELETE",
        headers: { token: instance.api_token },
      });

      // Remove from DB
      await supabase.from("whatsapp_instances").delete().eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
