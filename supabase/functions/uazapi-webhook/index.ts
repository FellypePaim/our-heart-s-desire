import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, token, admintoken",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    // UAZAPI sends different event types
    // Common fields: instance, event, data
    const event = body.event || body.type || "";
    const instanceName = body.instance || body.instanceName || "";

    if (!instanceName) {
      return new Response(JSON.stringify({ ok: true, message: "No instance name" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the user who owns this instance
    const { data: instance, error: instError } = await supabase
      .from("whatsapp_instances")
      .select("user_id, instance_key")
      .eq("instance_key", instanceName)
      .maybeSingle();

    if (instError || !instance) {
      console.log("Instance not found in DB:", instanceName);
      return new Response(JSON.stringify({ ok: true, message: "Instance not mapped" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = instance.user_id;

    // Handle disconnect events
    const isDisconnect = [
      "disconnect",
      "disconnected",
      "connection.update",
      "logout",
      "close",
      "status.instance",
    ].some((e) => event.toLowerCase().includes(e.toLowerCase()));

    const connectionState = body.data?.state || body.data?.status || body.state || "";
    const isActuallyDisconnected =
      isDisconnect ||
      connectionState === "disconnected" ||
      connectionState === "close" ||
      connectionState === "logout";

    if (isActuallyDisconnected) {
      // Update connection status in DB
      await supabase
        .from("whatsapp_instances")
        .update({ connection_status: "disconnected" })
        .eq("instance_key", instanceName);

      // Create notification for the user
      await supabase.from("whatsapp_notifications").insert({
        user_id: userId,
        type: "disconnect",
        message: "Seu WhatsApp foi desconectado. Vá em Configurações para reconectar.",
        metadata: { event, instanceName, connectionState, timestamp: new Date().toISOString() },
      });

      console.log("Disconnect notification created for user:", userId);
    }

    // Handle connected events
    const isConnected =
      connectionState === "connected" ||
      event.toLowerCase().includes("connected") ||
      event.toLowerCase().includes("ready");

    if (isConnected) {
      await supabase
        .from("whatsapp_instances")
        .update({ connection_status: "connected" })
        .eq("instance_key", instanceName);

      console.log("Instance connected:", instanceName);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
