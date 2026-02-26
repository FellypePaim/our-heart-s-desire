import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Reseller {
  id: string;
  owner_user_id: string;
  display_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  client_count?: number;
}

export function useResellers() {
  const { user, roles } = useAuth();
  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const isSuperAdmin = roles.some((r) => r.role === "super_admin" && r.is_active);

  return useQuery({
    queryKey: ["resellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resellers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

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
    enabled: !!user && (isPanelAdmin || isSuperAdmin),
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
