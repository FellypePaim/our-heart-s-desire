import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const subdomain = Deno.env.get("UAZAPI_SUBDOMAIN");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!subdomain) {
      return new Response(JSON.stringify({ error: "UAZAPI_SUBDOMAIN not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if manual execution with specific rule_id
    let manualRuleId: string | null = null;
    try {
      const body = await req.json();
      manualRuleId = body?.rule_id || null;
    } catch { /* no body = cron call */ }

    // Current time in São Paulo
    const nowStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const now = new Date(nowStr);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Today as YYYY-MM-DD in São Paulo
    const todayStr = now.toISOString().split("T")[0];
    const [tY, tM, tD] = todayStr.split("-").map(Number);
    const today = new Date(tY, tM - 1, tD);

    let rules: any[];

    if (manualRuleId) {
      // Manual execution: fetch specific rule, ignore schedule
      const { data, error } = await supabase
        .from("billing_rules")
        .select("*")
        .eq("id", manualRuleId);
      if (error) throw error;
      rules = data || [];
    } else {
      // Cron execution: match hour/minute
      const { data, error } = await supabase
        .from("billing_rules")
        .select("*")
        .eq("is_active", true)
        .eq("send_hour", currentHour)
        .eq("send_minute", currentMinute);
      if (error) throw error;
      rules = data || [];
    }

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: "No rules to run now", hour: currentHour, minute: currentMinute }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const rule of rules) {
      // Check if already ran today for this rule (skip for manual runs)
      if (!manualRuleId) {
        const { data: existingLogs } = await supabase
          .from("billing_rule_logs")
          .select("id")
          .eq("rule_id", rule.id)
          .gte("executed_at", todayStr + "T00:00:00-03:00")
          .limit(1);

        if (existingLogs && existingLogs.length > 0) {
          console.log(`Rule ${rule.id} already ran today, skipping`);
          continue;
        }
      }

      // Get the user's whatsapp instance
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_key, api_token")
        .eq("user_id", rule.user_id)
        .maybeSingle();

      if (!instance || !instance.api_token) {
        // Log error - no WhatsApp
        await supabase.from("billing_rule_logs").insert({
          rule_id: rule.id,
          user_id: rule.user_id,
          clients_matched: 0,
          messages_sent: 0,
          messages_failed: 0,
          errors: [{ error: "WhatsApp não vinculado" }],
          status: "error",
        });
        continue;
      }

      // Get clients for this user
      const { data: clients } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", rule.user_id)
        .eq("is_suspended", false);

      if (!clients || clients.length === 0) continue;

      // Filter clients based on rule criteria
      const matchingClients = clients.filter((c: any) => {
        if (!c.phone) return false;

        // Status filter
        if (rule.status_filter && rule.status_filter.length > 0) {
          const [eY, eM, eD] = c.expiration_date.split("-").map(Number);
          const expDate = new Date(eY, eM - 1, eD);
          const diffDays = Math.round(
            (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );

          let statusKey = "";
          if (diffDays > 3) statusKey = "active";
          else if (diffDays === 3) statusKey = "pre3";
          else if (diffDays === 2) statusKey = "pre2";
          else if (diffDays === 1) statusKey = "pre1";
          else if (diffDays === 0) statusKey = "today";
          else if (diffDays === -1) statusKey = "post1";
          else if (diffDays === -2) statusKey = "post2";
          else statusKey = "expired";

          if (!rule.status_filter.includes(statusKey)) return false;
        }

        // Period filter
        if (rule.period_value > 0) {
          const [eY, eM, eD] = c.expiration_date.split("-").map(Number);
          const expDate = new Date(eY, eM - 1, eD);
          const diff = Math.round(
            (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );

          let multiplier = 1;
          if (rule.period_type === "horas") multiplier = 1 / 24;
          if (rule.period_type === "semanas") multiplier = 7;
          if (rule.period_type === "meses") multiplier = 30;

          const targetDiff = rule.period_value * multiplier;

          if (rule.period_direction === "before") {
            if (diff > targetDiff || diff < 0) return false;
          } else {
            if (diff > 0 || Math.abs(diff) > targetDiff) return false;
          }
        }

        return true;
      });

      const errors: any[] = [];
      let sent = 0;
      let failed = 0;

      const uazapiUrl = `https://${subdomain}.uazapi.com/send/text`;

      for (const client of matchingClients) {
        const phoneClean = client.phone.replace(/\D/g, "");
        const [eY, eM, eD] = client.expiration_date.split("-").map(Number);
        const formattedDate = `${String(eD).padStart(2, "0")}/${String(eM).padStart(2, "0")}/${eY}`;

        let text = rule.message_template
          .replace(/\{nome\}/g, client.name)
          .replace(/\{plano\}/g, client.plan || "")
          .replace(/\{vencimento\}/g, formattedDate);

        // Random delay between min and max
        const delay = Math.floor(
          Math.random() * (rule.delay_max - rule.delay_min + 1) + rule.delay_min
        ) * 1000;

        if (sent > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }

        try {
          const res = await fetch(uazapiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              token: instance.api_token,
            },
            body: JSON.stringify({
              number: phoneClean,
              text: text,
            }),
          });

          if (!res.ok) {
            const errData = await res.text();
            errors.push({ client_id: client.id, client_name: client.name, error: errData });
            failed++;
          } else {
            sent++;
            // Log individual message
            await supabase.from("message_logs").insert({
              user_id: rule.user_id,
              client_id: client.id,
              status_at_send: "billing_rule",
              template_used: text,
              delivery_status: "sent",
            });
          }
        } catch (err: any) {
          errors.push({ client_id: client.id, client_name: client.name, error: err.message });
          failed++;
        }
      }

      // Log execution
      await supabase.from("billing_rule_logs").insert({
        rule_id: rule.id,
        user_id: rule.user_id,
        clients_matched: matchingClients.length,
        messages_sent: sent,
        messages_failed: failed,
        errors: errors.length > 0 ? errors : [],
        status: failed === matchingClients.length && matchingClients.length > 0 ? "error" : sent > 0 ? "completed" : "no_matches",
      });

      // Update rule stats
      await supabase.from("billing_rules").update({
        last_run_at: new Date().toISOString(),
        last_run_count: sent,
        total_sent: (rule.total_sent || 0) + sent,
      }).eq("id", rule.id);

      totalSent += sent;
    }

    return new Response(
      JSON.stringify({ success: true, rules_processed: rules.length, total_sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Cron billing error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
