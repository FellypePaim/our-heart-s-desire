import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all active whatsapp instances
    const { data: instances, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('is_active', true);

    if (instanceError) throw instanceError;
    if (!instances || instances.length === 0) {
      return new Response(JSON.stringify({ message: "No active instances found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let messagesSent = 0;

    // Iterate over instances
    for (const instance of instances) {
      const ownerId = instance.user_id;

      // Get templates for this user
      const { data: templates } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', ownerId);

      if (!templates || templates.length === 0) continue;

      // Map templates by status_key
      const tplMap: Record<string, string> = {};
      for (const t of templates) {
        tplMap[t.status_key] = t.template_text;
      }

      // We handle: "vencimento_hoje", "vence_3_dias", "vencido"
      // Wait, we need the clients belonging to this owner or to their resellers.
      // For simplicity, let's get all clients where owner/reseller matches. If they are the master, we could fetch their direct clients.

      // This requires complex logic to find matching clients. 
      // For now, let's find clients directly owned by user_id
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', ownerId)
        .eq('is_suspended', false);

      if (!clients) continue;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const client of clients) {
        if (!client.phone) continue;
        const expDate = new Date(client.expiration_date);
        expDate.setHours(0, 0, 0, 0);

        const diffTime = expDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let statusKey = "";
        if (diffDays === 3) statusKey = "vence_3_dias";
        else if (diffDays === 0) statusKey = "vencimento_hoje";
        else if (diffDays === -1) statusKey = "vencido"; // 1 day ago

        if (statusKey && tplMap[statusKey]) {
          let text = tplMap[statusKey];
          text = text.replace(/\{nome\}/g, client.name)
            .replace(/\{plano\}/g, client.plan || "")
            .replace(/\{vencimento\}/g, new Date(client.expiration_date).toLocaleDateString('pt-BR'));

          const phoneFormat = client.phone.replace(/\D/g, ""); // keep only numbers

          // Send via UAZAPI
          const uazapiUrl = `https://api.uazapi.dev/instances/${instance.instance_key}/message/sendText`;

          try {
            await fetch(uazapiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": instance.api_token
              },
              body: JSON.stringify({
                number: phoneFormat,
                text: text,
                delay: 1500
              })
            });
            // Log to db
            await supabase.from('message_logs').insert({
              user_id: ownerId,
              client_id: client.id,
              status_at_send: statusKey,
              template_used: text,
              delivery_status: "sent"
            });
            messagesSent++;
          } catch (err) {
            console.error(`Failed to send UAZAPI message for client ${client.id}`, err);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent: messagesSent
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
