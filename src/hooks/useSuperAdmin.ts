import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tenant, UserRole, Client, AuditLog } from "@/lib/supabase-types";

export function useTenants() {
  const { isSuperAdmin } = useAuth();
  return useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tenant[];
    },
    enabled: isSuperAdmin,
  });
}

export function useAllUserRoles() {
  const { isSuperAdmin } = useAuth();
  return useQuery({
    queryKey: ["all_user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: isSuperAdmin,
  });
}

export function useAllClients() {
  const { isSuperAdmin } = useAuth();
  return useQuery({
    queryKey: ["all_clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("expiration_date", { ascending: true });
      if (error) throw error;
      return data as Client[];
    },
    enabled: isSuperAdmin,
  });
}

export function useAuditLogs() {
  const { isSuperAdmin } = useAuth();
  return useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: isSuperAdmin,
  });
}

export function useGlobalStats() {
  const { isSuperAdmin } = useAuth();
  return useQuery({
    queryKey: ["global_stats"],
    queryFn: async () => {
      const [tenantsRes, rolesRes, clientsRes] = await Promise.all([
        supabase.from("tenants").select("id, status", { count: "exact" }),
        supabase.from("user_roles").select("id, role", { count: "exact" }),
        supabase.from("clients").select("id, expiration_date", { count: "exact" }),
      ]);

      const tenants = tenantsRes.data || [];
      const roles = rolesRes.data || [];
      const clients = clientsRes.data || [];

      const activeTenants = tenants.filter((t: any) => t.status === "active").length;
      const totalUsers = new Set(roles.map((r: any) => r.user_id)).size;
      const resellers = roles.filter((r: any) => r.role === "reseller").length;
      const totalClients = clients.length;

      const today = new Date();
      const overdueClients = clients.filter((c: any) => new Date(c.expiration_date) < today).length;
      const overdueRate = totalClients > 0 ? Math.round((overdueClients / totalClients) * 100) : 0;

      return {
        activeTenants,
        totalTenants: tenants.length,
        totalUsers,
        resellers,
        totalClients,
        overdueClients,
        overdueRate,
      };
    },
    enabled: isSuperAdmin,
  });
}
