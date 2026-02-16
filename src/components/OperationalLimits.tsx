import { useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { useMyReseller, useResellers } from "@/hooks/useResellers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Users, AlertTriangle } from "lucide-react";

export function OperationalLimits() {
  const { roles, user } = useAuth();
  const { data: clients } = useClients();
  const { data: myReseller } = useMyReseller();

  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);

  // Fetch profile limits for Master
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

  // Fetch reseller count for Master
  const { data: resellers } = useResellers();

  const limits = useMemo(() => {
    if (!clients) return null;

    if (isReseller && myReseller) {
      const maxClients = myReseller.limits?.max_clients || 50;
      const maxMessages = myReseller.limits?.max_messages_month || 500;
      const currentClients = clients.filter((c) => c.reseller_id === myReseller.id).length;

      return {
        label: "Revendedor",
        items: [
          { name: "Clientes", current: currentClients, max: maxClients },
          { name: "Mensagens/mês", current: 0, max: maxMessages },
        ],
      };
    }

    if (isPanelAdmin) {
      const profileLimits = (profile?.limits as any) || {};
      const maxClients = profileLimits.max_clients ?? 200;
      const maxResellers = profileLimits.max_resellers ?? 10;
      const directClients = clients.filter((c) => c.user_id === user?.id).length;
      const resellerCount = resellers?.length || 0;

      return {
        label: "Master",
        items: [
          { name: "Clientes diretos", current: directClients, max: maxClients },
          { name: "Revendedores", current: resellerCount, max: maxResellers },
        ],
      };
    }

    return null;
  }, [clients, myReseller, isReseller, isPanelAdmin, user?.id, profile, resellers]);

  if (!limits) return null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Users className="h-4 w-4" />
        Limites Operacionais — {limits.label}
      </h3>
      <div className="space-y-3">
        {limits.items.map((item) => {
          const pct = item.max > 0 ? Math.min(100, Math.round((item.current / item.max) * 100)) : 0;
          const isNearLimit = pct >= 80;
          const isAtLimit = pct >= 100;

          return (
            <div key={item.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  {item.name}
                  {isNearLimit && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                </span>
                <span className={`font-mono font-medium ${isAtLimit ? "text-destructive" : isNearLimit ? "text-amber-500" : "text-foreground"}`}>
                  {item.current} / {item.max}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
              {isAtLimit && (
                <p className="text-xs text-destructive">Limite atingido! Contate o administrador para aumentar.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
