import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Client } from "@/lib/supabase-types";
import { useAuth } from "./useAuth";

interface UseClientsOptions {
  ownOnly?: boolean;
}

export function useClients(options?: UseClientsOptions) {
  const { user, roles } = useAuth();
  const ownOnly = options?.ownOnly ?? false;

  return useQuery({
    queryKey: ["clients", user?.id, ownOnly],
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select("*")
        .order("expiration_date", { ascending: true });

      // When ownOnly is true, filter to only the user's direct clients
      // This ensures SuperAdmin/Master dashboards show only their own data
      if (ownOnly && user) {
        const isSuperAdmin = roles.some((r) => r.role === "super_admin" && r.is_active);
        const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
        const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);

        if (isSuperAdmin || isPanelAdmin) {
          // Show only clients directly owned by this user (not through resellers)
          query = query.eq("user_id", user.id);
        }
        // Resellers already only see their own clients via RLS, no extra filter needed
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user,
  });
}
