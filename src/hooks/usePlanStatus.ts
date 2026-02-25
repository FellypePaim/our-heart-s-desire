import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface PlanStatus {
  planType: string;
  expiresAt: Date;
  isExpired: boolean;
  isTrial: boolean;
  remainingMs: number;
  masterExpired: boolean; // for resellers: is master's plan expired?
}

export function usePlanStatus() {
  const { user, isSuperAdmin, roles } = useAuth();

  return useQuery({
    queryKey: ["plan-status", user?.id],
    queryFn: async (): Promise<PlanStatus> => {
      if (!user) throw new Error("No user");

      // SuperAdmins never expire
      if (isSuperAdmin) {
        return {
          planType: "unlimited",
          expiresAt: new Date(2099, 0, 1),
          isExpired: false,
          isTrial: false,
          remainingMs: Infinity,
          masterExpired: false,
        };
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("plan_type, plan_expires_at")
        .eq("user_id", user.id)
        .single();

      if (error || !profile) {
        return {
          planType: "trial",
          expiresAt: new Date(),
          isExpired: true,
          isTrial: true,
          remainingMs: 0,
          masterExpired: false,
        };
      }

      const expiresAt = new Date(profile.plan_expires_at);
      const now = new Date();
      const remainingMs = expiresAt.getTime() - now.getTime();
      const isExpired = remainingMs <= 0;
      const isTrial = profile.plan_type === "trial";

      // Check master's plan for resellers
      let masterExpired = false;
      const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);
      if (isReseller) {
        const { data: masterActive } = await supabase.rpc("is_master_plan_active", {
          _user_id: user.id,
        });
        masterExpired = !masterActive;
      }

      return {
        planType: profile.plan_type,
        expiresAt,
        isExpired,
        isTrial,
        remainingMs: Math.max(0, remainingMs),
        masterExpired,
      };
    },
    enabled: !!user,
    refetchInterval: 30000, // check every 30s (important for trial countdown)
  });
}
