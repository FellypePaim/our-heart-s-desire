import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { phone, message } = await req.json();
    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "phone e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's whatsapp instance
    const { data: instance, error: instError } = await supabase
      .from("whatsapp_instances")
      .select("instance_key, api_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (instError || !instance || !instance.instance_key || !instance.api_token) {
      return new Response(
        JSON.stringify({ error: "Instância WhatsApp não configurada. Vá em Configurações para vincular." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via UAZAPI
    const cleanPhone = phone.replace(/\D/g, "");
    const uazapiUrl = `https://v5.uazapi.com.br/${instance.instance_key}/messages/chat`;

    const uazapiResponse = await fetch(uazapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Admin-Token": instance.api_token,
      },
      body: JSON.stringify({
        number: cleanPhone,
        message: message,
      }),
    });

    const uazapiData = await uazapiResponse.json();

    if (!uazapiResponse.ok) {
      console.error("UAZAPI error:", uazapiData);
      return new Response(
        JSON.stringify({
          error: "Erro ao enviar via UAZAPI",
          details: uazapiData,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: uazapiData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
