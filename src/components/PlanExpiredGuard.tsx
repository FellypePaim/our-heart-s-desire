import { usePlanStatus } from "@/hooks/usePlanStatus";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Clock, MessageCircle, AlertTriangle, Crown } from "lucide-react";
import { useEffect, useState } from "react";

function formatTime(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

const WHATSAPP_NUMBER = "5537991237543";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Olá! Gostei do sistema e gostaria de assinar um plano. Pode me ajudar?"
);

export function PlanExpiredGuard({ children }: { children: React.ReactNode }) {
  const { user, signOut, isSuperAdmin } = useAuth();
  const { data: plan, isLoading } = usePlanStatus();
  const [now, setNow] = useState(Date.now());

  // Tick every second for trial countdown
  useEffect(() => {
    if (!plan?.isTrial || plan.isExpired) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [plan?.isTrial, plan?.isExpired]);

  if (!user || isLoading || isSuperAdmin) return <>{children}</>;
  if (!plan) return <>{children}</>;

  // Reseller whose master expired
  if (plan.masterExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Crown className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Acesso Bloqueado</h1>
          <p className="text-muted-foreground">
            O plano do seu administrador (Master) expirou. Seus serviços estão temporariamente suspensos até que ele renove o plano.
          </p>
          <p className="text-sm text-muted-foreground">
            Entre em contato com seu administrador para solicitar a renovação.
          </p>
          <Button variant="outline" onClick={signOut}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  // Trial active - show countdown banner + children
  if (plan.isTrial && !plan.isExpired) {
    const remaining = plan.expiresAt.getTime() - now;
    return (
      <>
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center justify-center gap-2 shrink-0">
          <Clock className="h-4 w-4" />
          Teste gratuito — tempo restante: {formatTime(remaining)}
        </div>
        {children}
      </>
    );
  }

  // Plan expired (trial or monthly)
  if (plan.isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">
            {plan.isTrial ? "Teste Expirado" : "Plano Expirado"}
          </h1>
          <p className="text-muted-foreground">
            {plan.isTrial
              ? "Seu período de teste gratuito de 15 minutos terminou. Para continuar usando o sistema, entre em contato e assine um plano."
              : "Seu plano expirou. Renove para continuar usando o sistema."}
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white w-full">
              <MessageCircle className="h-5 w-5" />
              Falar no WhatsApp
            </Button>
          </a>
          <p className="text-xs text-muted-foreground">
            WhatsApp: (37) 9 9123-7543
          </p>
          <Button variant="outline" onClick={signOut} className="w-full">
            Sair da conta
          </Button>
        </div>
      </div>
    );
  }

  // Plan active
  return <>{children}</>;
}
