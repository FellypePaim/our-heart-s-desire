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
  let sub = Deno.env.get("UAZAPI_SUBDOMAIN");
  if (!sub) throw new Error("UAZAPI_SUBDOMAIN não configurado");
  sub = sub.replace(/^https?:\/\//, "").replace(/\.uazapi\.com.*$/, "").replace(/\//g, "");
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

    const { action, phone: pairingPhone } = await req.json();
    const baseUrl = UAZAPI_BASE();
    const adminToken = UAZAPI_ADMIN_TOKEN();

    // ---- CREATE INSTANCE ----
    if (action === "create") {
      const { data: existing } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing?.instance_key && existing?.api_token) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Instância já existe",
          instance_key: existing.instance_key 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      const instanceToken = createData.token || createData.instance?.token || "";
      const instanceKey = createData.name || createData.instance?.name || instanceName;

      if (existing) {
        await supabase
          .from("whatsapp_instances")
          .update({ instance_key: instanceKey, api_token: instanceToken, connection_status: "disconnected" })
          .eq("user_id", user.id);
      } else {
        await supabase.from("whatsapp_instances").insert({
          user_id: user.id,
          instance_key: instanceKey,
          api_token: instanceToken,
          connection_status: "disconnected",
        });
      }

      // Auto-set webhook
      try {
        const webhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;
        await fetch(`${baseUrl}/webhook/set`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            token: instanceToken,
          },
          body: JSON.stringify({
            url: webhookUrl,
            enabled: true,
            events: ["connection.update", "status.instance", "disconnect"],
          }),
        });
        await supabase
          .from("whatsapp_instances")
          .update({ webhook_set: true })
          .eq("instance_key", instanceKey);
        console.log("Webhook set for instance:", instanceKey);
      } catch (webhookErr) {
        console.error("Failed to set webhook:", webhookErr);
      }

      return new Response(
        JSON.stringify({ success: true, instance_key: instanceKey, data: createData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- CONNECT (QR Code or Pairing Code) ----
    // Per UAZAPI docs: POST /instance/connect
    //   - Without "phone" field → generates QR Code
    //   - With "phone" field → generates 8-digit pairing code
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

      // Build request body - if phone is provided, UAZAPI returns pairing code instead of QR
      const connectBody: Record<string, unknown> = {};
      if (pairingPhone) {
        connectBody.phone = pairingPhone;
      }

      const connectRes = await fetch(`${baseUrl}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: instance.api_token,
        },
        body: JSON.stringify(connectBody),
      });

      const connectData = await connectRes.json();
      console.log("UAZAPI connect response:", JSON.stringify(connectData).substring(0, 500));
      
      // Extract QR code (when no phone was sent)
      const qrCode = connectData.qrcode || connectData.qrCode || connectData.base64 || connectData.qr || 
                      connectData.instance?.qrcode || connectData.data?.qrcode || connectData.data?.qrCode || null;
      
      // Extract pairing code (when phone was sent)
      const paircode = connectData.paircode || connectData.code || connectData.pairingCode || 
                       connectData.instance?.paircode || connectData.data?.paircode || connectData.data?.code || null;

      // Only return valid pairing codes (string with 4+ chars, not empty)
      const validPaircode = (typeof paircode === "string" && paircode.length >= 4) ? paircode : null;
      
      return new Response(JSON.stringify({ 
        success: connectRes.ok, 
        data: { ...connectData, qrCode },
        qrCode,
        paircode: validPaircode,
      }), {
        status: connectRes.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- STATUS ----
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
      
      const qrCode = statusData.qrcode || statusData.qrCode || statusData.base64 || statusData.qr || 
                      statusData.instance?.qrcode || statusData.data?.qrcode || statusData.data?.qrCode || null;
      const instanceStatus = statusData.instance?.status || "unknown";
      const state = (typeof statusData.state === "string" ? statusData.state : null) || instanceStatus || statusData.status || "unknown";
      
      return new Response(JSON.stringify({ 
        success: true, 
        data: { ...statusData, qrCode, state } 
      }), {
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

      await fetch(`${baseUrl}/instance/delete`, {
        method: "DELETE",
        headers: { token: instance.api_token },
      });

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