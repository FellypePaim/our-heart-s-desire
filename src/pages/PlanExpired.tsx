import { useAuth } from "@/hooks/useAuth";
import { usePlanStatus } from "@/hooks/usePlanStatus";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Crown, MessageCircle, LogOut } from "lucide-react";

const WHATSAPP_NUMBER = "5537991237543";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Olá! Gostei do sistema e gostaria de assinar um plano. Pode me ajudar?"
);

const PlanExpired = () => {
  const { user, signOut, isSuperAdmin } = useAuth();
  const { data: plan, isLoading } = usePlanStatus();

  // SuperAdmins never see this page
  if (isSuperAdmin) return <Navigate to="/" replace />;

  // Still loading
  if (isLoading || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Verificando plano...</div>
      </div>
    );
  }

  // If plan is active and master is active, redirect back
  if (!plan.isExpired && !plan.masterExpired) {
    return <Navigate to="/" replace />;
  }

  const isMasterBlocked = plan.masterExpired;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          {isMasterBlocked ? (
            <Crown className="h-10 w-10 text-destructive" />
          ) : (
            <AlertTriangle className="h-10 w-10 text-destructive" />
          )}
        </div>

        <h1 className="text-2xl font-bold">
          {isMasterBlocked
            ? "Acesso Bloqueado"
            : plan.isTrial
              ? "Teste Expirado"
              : "Plano Expirado"}
        </h1>

        <p className="text-muted-foreground">
          {isMasterBlocked
            ? "O plano do seu administrador (Master) expirou. Seus serviços estão temporariamente suspensos até que ele renove o plano."
            : plan.isTrial
              ? "Seu período de teste gratuito de 15 minutos terminou. Para continuar usando o sistema, entre em contato e assine um plano."
              : "Seu plano expirou. Renove para continuar usando o sistema."}
        </p>

        {!isMasterBlocked ? (
          <>
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
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Entre em contato com seu administrador para solicitar a renovação.
          </p>
        )}

        <Button variant="outline" onClick={signOut} className="w-full gap-2">
          <LogOut className="h-4 w-4" />
          Sair da conta
        </Button>
      </div>
    </div>
  );
};

export default PlanExpired;
