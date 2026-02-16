import { useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { useMyReseller, useResellers } from "@/hooks/useResellers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLimitCheck() {
  const { user, roles } = useAuth();
  const { data: clients } = useClients();
  const { data: myReseller } = useMyReseller();
  const { data: resellers } = useResellers();

  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);

  const { data: profile } = useQuery({
    queryKey: ["profile_limits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("limits")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && isPanelAdmin,
  });

  return useMemo(() => {
    if (!clients) return { canCreateClient: true, canCreateReseller: true, clientLimitMsg: "", resellerLimitMsg: "" };

    if (isReseller && myReseller) {
      const maxClients = myReseller.limits?.max_clients || 50;
      const currentClients = clients.filter((c) => c.reseller_id === myReseller.id).length;
      const canCreate = currentClients < maxClients;
      return {
        canCreateClient: canCreate,
        canCreateReseller: false,
        clientLimitMsg: canCreate ? "" : `Limite de ${maxClients} clientes atingido.`,
        resellerLimitMsg: "",
      };
    }

    if (isPanelAdmin) {
      const profileLimits = (profile?.limits as any) || {};
      const maxClients = profileLimits.max_clients ?? 200;
      const maxResellers = profileLimits.max_resellers ?? 10;
      const directClients = clients.filter((c) => c.user_id === user?.id).length;
      const resellerCount = resellers?.length || 0;

      return {
        canCreateClient: directClients < maxClients,
        canCreateReseller: resellerCount < maxResellers,
        clientLimitMsg: directClients >= maxClients ? `Limite de ${maxClients} clientes diretos atingido.` : "",
        resellerLimitMsg: resellerCount >= maxResellers ? `Limite de ${maxResellers} revendedores atingido.` : "",
      };
    }

    return { canCreateClient: true, canCreateReseller: true, clientLimitMsg: "", resellerLimitMsg: "" };
  }, [clients, myReseller, isReseller, isPanelAdmin, user?.id, profile, resellers]);
}
