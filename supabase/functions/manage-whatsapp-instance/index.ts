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
  // Handle cases where the full URL or domain was stored instead of just the subdomain
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

      // Auto-set webhook for disconnect/connect notifications
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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

        // Mark webhook as set
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
      console.log("UAZAPI connect response keys:", JSON.stringify(Object.keys(connectData)));
      
      // Normalize QR code from various possible field names
      const qrCode = connectData.qrcode || connectData.qrCode || connectData.base64 || connectData.qr || connectData.data?.qrcode || connectData.data?.qrCode || null;
      
      return new Response(JSON.stringify({ 
        success: connectRes.ok, 
        data: { ...connectData, qrCode },
        qrCode 
      }), {
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
      console.log("UAZAPI status response keys:", JSON.stringify(Object.keys(statusData)));
      
      // Normalize QR code from various possible field names including nested instance
      const qrCode = statusData.qrcode || statusData.qrCode || statusData.base64 || statusData.qr || statusData.instance?.qrcode || statusData.data?.qrcode || statusData.data?.qrCode || null;
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

    // ---- PAIRING CODE (link via phone number) ----
    if (action === "pairingcode") {
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

      if (!pairingPhone) {
        return new Response(
          JSON.stringify({ error: "Número de telefone é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // First ensure the instance is connecting (call connect)
      try {
        await fetch(`${baseUrl}/instance/connect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            token: instance.api_token,
          },
        });
        // Small delay to let the instance initialize
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        console.log("Connect before pairing failed:", e);
      }

      // Now request pairing code
      let code: string | null = null;
      
      // Try GET /instance/pairingcode with query params
      try {
        const pairRes = await fetch(`${baseUrl}/instance/pairingcode?phone=${pairingPhone}`, {
          method: "GET",
          headers: {
            token: instance.api_token,
          },
        });
        const pairData = await pairRes.json();
        console.log("UAZAPI pairingcode GET response:", JSON.stringify(pairData));
        // Only accept string codes with 4+ chars (avoid picking up HTTP status codes)
        const rawCode = pairData?.code || pairData?.pairingCode || pairData?.pairing_code || pairData?.data?.code || null;
        if (typeof rawCode === "string" && rawCode.length >= 4) {
          code = rawCode;
        }
      } catch (e) {
        console.error("pairingcode GET endpoint failed:", e);
      }

      // Fallback: try connect with pairingCode flag
      if (!code) {
        try {
          const pairRes2 = await fetch(`${baseUrl}/instance/connect`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              token: instance.api_token,
            },
            body: JSON.stringify({ pairingCode: true, phone: pairingPhone }),
          });
          const pairData2 = await pairRes2.json();
          console.log("UAZAPI connect+pairing response keys:", JSON.stringify(Object.keys(pairData2)));
          const rawCode2 = pairData2?.code || pairData2?.pairingCode || pairData2?.paircode || pairData2?.instance?.paircode || null;
          if (typeof rawCode2 === "string" && rawCode2.length >= 4) {
            code = rawCode2;
          }
        } catch (e) {
          console.error("pairing via connect also failed:", e);
        }
      }

      return new Response(JSON.stringify({ 
        success: !!code, 
        code,
      }), {
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
