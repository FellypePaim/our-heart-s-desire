import { usePlanStatus } from "@/hooks/usePlanStatus";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

function formatDaysRemaining(ms: number) {
  const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

export function PlanExpiredGuard({ children }: { children: React.ReactNode }) {
  const { user, isSuperAdmin } = useAuth();
  const { data: plan, isLoading } = usePlanStatus();
  const [now, setNow] = useState(Date.now());

  // Tick every minute for trial countdown (days don't need per-second updates)
  useEffect(() => {
    if (!plan?.isTrial || plan.isExpired) return;
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [plan?.isTrial, plan?.isExpired]);

  if (!user || isLoading || isSuperAdmin) return <>{children}</>;
  if (!plan) return <>{children}</>;

  // Expired or master expired → redirect to dedicated page
  if (plan.isExpired || plan.masterExpired) {
    return <Navigate to="/plan-expired" replace />;
  }

  // Trial active - show countdown banner + children
  if (plan.isTrial && !plan.isExpired) {
    const remaining = plan.expiresAt.getTime() - now;
    return (
      <>
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center justify-center gap-2 shrink-0">
          <Clock className="h-4 w-4" />
          Teste gratuito — {formatDaysRemaining(remaining)} restantes
        </div>
        {children}
      </>
    );
  }

  // Plan active
  return <>{children}</>;
}
