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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user already has a role (prevent duplicate calls)
    const { data: existingRoles } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (existingRoles && existingRoles.length > 0) {
      return new Response(JSON.stringify({ success: true, message: "Role already exists" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { role } = body;

    // Only allow self-registration as panel_admin or reseller
    if (role !== "panel_admin" && role !== "reseller") {
      return new Response(JSON.stringify({ error: "Invalid role. Must be panel_admin or reseller." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create role
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: user.id,
      role,
      is_active: true,
    });
    if (roleError) throw roleError;

    // Create profile (trigger sets trial plan)
    const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "";
    const { error: profileError } = await adminClient.from("profiles").insert({
      user_id: user.id,
      display_name: displayName,
    });
    if (profileError && !profileError.message.includes("duplicate")) throw profileError;

    // If reseller, create reseller record (self-created, no master)
    if (role === "reseller") {
      await adminClient.from("resellers").insert({
        owner_user_id: user.id,
        display_name: displayName,
        limits: { max_clients: 50, max_messages_month: 500 },
        created_by: null,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
