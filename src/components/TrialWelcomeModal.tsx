import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Zap, Users, MessageCircle, BarChart3, Shield, Settings, FileText, Smartphone, Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePlanStatus } from "@/hooks/usePlanStatus";
import { Progress } from "@/components/ui/progress";

const STORAGE_KEY = "brave_trial_modal_seen";

const features = [
  { icon: Users, title: "Gestão de Clientes", desc: "Cadastre, edite e acompanhe todos os seus clientes em um só lugar" },
  { icon: Store, title: "Rede de Revendedores", desc: "Crie e gerencie sua rede de revendedores com controle total" },
  { icon: MessageCircle, title: "WhatsApp Integrado", desc: "Envie lembretes e cobranças automaticamente pelo WhatsApp" },
  { icon: BarChart3, title: "Relatórios e Radar", desc: "Métricas de receita, churn e previsões inteligentes" },
  { icon: Settings, title: "Configurações Flexíveis", desc: "Personalize planos, servidores, apps e formas de pagamento" },
  { icon: FileText, title: "Exportação CSV/PDF", desc: "Exporte relatórios completos para análise externa" },
  { icon: Shield, title: "Controle de Acesso", desc: "Hierarquia segura: Master → Revendedor → Cliente" },
  { icon: Smartphone, title: "100% Responsivo", desc: "Acesse de qualquer dispositivo, desktop ou mobile" },
];

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
  const totalTrialMin = 25;
  const progressPct = Math.min(100, (remainingMin / totalTrialMin) * 100);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold">
            Bem-vindo ao Brave Gestor! 🚀
          </DialogTitle>
          <DialogDescription className="text-base">
            Seu período de teste gratuito está ativo. Explore tudo!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Timer card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg leading-tight">
                  {remainingMin} {remainingMin === 1 ? "minuto" : "minutos"} restantes
                </p>
                <p className="text-xs text-muted-foreground">
                  de {totalTrialMin} minutos de teste gratuito
                </p>
              </div>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>

          {/* Features grid */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              ✨ Recursos disponíveis para você:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <f.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{f.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA info */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
            <p className="text-sm font-medium mb-1">💡 Gostou? Assine um plano!</p>
            <p className="text-xs text-muted-foreground">
              Após o teste, assine para continuar usando. Fale conosco pelo WhatsApp{" "}
              <a
                href="https://wa.me/5537991237543?text=Olá! Gostaria de saber mais sobre os planos do Brave Gestor."
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                (37) 9 9123-7543
              </a>
            </p>
          </div>

          <Button onClick={handleClose} className="w-full gap-2 h-11 text-base font-semibold">
            <Zap className="h-5 w-5" />
            Começar a explorar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
