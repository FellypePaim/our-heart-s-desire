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

    // Verify caller
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller role
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role, tenant_id, is_active")
      .eq("user_id", caller.id)
      .eq("is_active", true);

    const isSuperAdmin = callerRoles?.some((r: any) => r.role === "super_admin");
    const isPanelAdmin = callerRoles?.some((r: any) => r.role === "panel_admin");
    const callerTenantId = callerRoles?.find((r: any) => r.tenant_id)?.tenant_id;

    if (!isSuperAdmin && !isPanelAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, name, role, tenant_id } = body;

    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, password, role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hierarchy enforcement
    const roleRank: Record<string, number> = { user: 0, reseller: 1, panel_admin: 2, super_admin: 3 };
    const callerRank = isSuperAdmin ? 3 : 2;
    if ((roleRank[role] ?? 0) >= callerRank) {
      return new Response(JSON.stringify({ error: "Cannot create user with equal or higher role" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Panel admin can only create resellers in their own tenant
    if (isPanelAdmin && !isSuperAdmin) {
      if (role !== "reseller") {
        return new Response(JSON.stringify({ error: "Panel admin can only create reseller accounts" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const effectiveTenantId = isSuperAdmin ? (tenant_id || null) : callerTenantId;

    // Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name || email.split("@")[0] },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create role
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: newUser.user.id,
      role,
      tenant_id: effectiveTenantId,
      is_active: true,
    });

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If creating a reseller, also create the reseller record
    if (role === "reseller" && effectiveTenantId) {
      await adminClient.from("resellers").insert({
        tenant_id: effectiveTenantId,
        owner_user_id: newUser.user.id,
        display_name: name || email.split("@")[0],
        limits: { max_clients: 50, max_messages_month: 500 },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: newUser.user.id,
      email: newUser.user.email,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
