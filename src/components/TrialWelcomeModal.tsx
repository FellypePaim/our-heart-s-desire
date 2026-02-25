import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Zap, Users, MessageCircle, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePlanStatus } from "@/hooks/usePlanStatus";

const STORAGE_KEY = "brave_trial_modal_seen";

export function TrialWelcomeModal() {
  const [open, setOpen] = useState(false);
  const { user, isSuperAdmin } = useAuth();
  const { data: plan } = usePlanStatus();

  useEffect(() => {
    if (!user || !plan || isSuperAdmin) return;
    if (!plan.isTrial || plan.isExpired) return;

    const seen = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
    if (!seen) {
      setOpen(true);
    }
  }, [user, plan, isSuperAdmin]);

  const handleClose = () => {
    if (user) {
      localStorage.setItem(`${STORAGE_KEY}_${user.id}`, "true");
    }
    setOpen(false);
  };

  if (!plan) return null;

  const remainingMin = Math.max(0, Math.ceil(plan.remainingMs / 60000));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-5 w-5 text-amber-500" />
            Bem-vindo ao Brave Gestor!
          </DialogTitle>
          <DialogDescription>
            Seu período de teste gratuito está ativo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                Você tem {remainingMin} {remainingMin === 1 ? "minuto" : "minutos"} de teste
              </p>
              <p className="text-xs text-muted-foreground">
                Explore todas as funcionalidades do sistema antes que o tempo expire
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">O que você pode fazer:</p>
            <div className="grid gap-2">
              {[
                { icon: Users, text: "Cadastrar e gerenciar clientes" },
                { icon: MessageCircle, text: "Enviar mensagens via WhatsApp" },
                { icon: BarChart3, text: "Acompanhar relatórios e métricas" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <item.icon className="h-4 w-4 text-primary shrink-0" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <p>
              Após o período de teste, você precisará assinar um plano para continuar usando o sistema.
              Entre em contato pelo WhatsApp <strong>(37) 9 9123-7543</strong> para saber mais.
            </p>
          </div>

          <Button onClick={handleClose} className="w-full gap-2">
            <Zap className="h-4 w-4" />
            Começar a explorar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
