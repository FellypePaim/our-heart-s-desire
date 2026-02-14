import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Reseller {
  id: string;
  tenant_id: string;
  owner_user_id: string;
  display_name: string;
  status: string;
  limits: { max_clients?: number; max_messages_month?: number };
  created_at: string;
  updated_at: string;
  client_count?: number;
}

export function useResellers(tenantId?: string | null) {
  const { user, roles } = useAuth();
  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const effectiveTenantId = tenantId || roles.find((r) => r.tenant_id && r.is_active)?.tenant_id;

  return useQuery({
    queryKey: ["resellers", effectiveTenantId],
    queryFn: async () => {
      let query = supabase
        .from("resellers")
        .select("*")
        .order("created_at", { ascending: false });

      if (effectiveTenantId) {
        query = query.eq("tenant_id", effectiveTenantId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get client counts per reseller
      const resellers = data as Reseller[];
      if (resellers.length > 0) {
        const { data: counts } = await supabase
          .from("clients")
          .select("reseller_id")
          .in("reseller_id", resellers.map((r) => r.id));

        const countMap: Record<string, number> = {};
        counts?.forEach((c: any) => {
          countMap[c.reseller_id] = (countMap[c.reseller_id] || 0) + 1;
        });

        resellers.forEach((r) => {
          r.client_count = countMap[r.id] || 0;
        });
      }

      return resellers;
    },
    enabled: !!user && (isPanelAdmin || roles.some((r) => r.role === "super_admin")),
  });
}

export function useMyReseller() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my_reseller", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resellers")
        .select("*")
        .eq("owner_user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as Reseller | null;
    },
    enabled: !!user,
  });
}
