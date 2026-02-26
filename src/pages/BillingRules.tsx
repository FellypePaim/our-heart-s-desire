import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Plus, Pencil, Trash2, Power, PowerOff, Clock, Users, Calendar,
  MessageSquare, Activity
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BillingRuleDialog } from "@/components/BillingRuleDialog";

interface BillingRule {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  message_template: string;
  status_filter: string[];
  billing_type: string;
  period_type: string;
  period_value: number;
  period_direction: string;
  delay_min: number;
  delay_max: number;
  send_hour: number;
  send_minute: number;
  last_run_at: string | null;
  last_run_count: number | null;
  total_sent: number | null;
  created_at: string;
  updated_at: string;
}

const BillingRules = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients = [] } = useClients({ ownOnly: true });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BillingRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["billing_rules", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_rules")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BillingRule[];
    },
    enabled: !!user,
  });

  const handleToggle = async (rule: BillingRule) => {
    const { error } = await supabase
      .from("billing_rules")
      .update({ is_active: !rule.is_active })
      .eq("id", rule.id);
    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } else {
      toast({ title: rule.is_active ? "Cobrança desativada" : "Cobrança ativada" });
      queryClient.invalidateQueries({ queryKey: ["billing_rules"] });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("billing_rules").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Cobrança excluída" });
      queryClient.invalidateQueries({ queryKey: ["billing_rules"] });
    }
    setDeleteId(null);
  };

  const handleEdit = (rule: BillingRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const getFilterLabel = (rule: BillingRule) => {
    const parts: string[] = [];
    if (rule.status_filter && rule.status_filter.length > 0) {
      parts.push(`Status: ${rule.status_filter.join(", ")}`);
    }
    if (rule.period_value > 0) {
      const dir = rule.period_direction === "before" ? "antes" : "depois";
      parts.push(`${rule.period_value} ${rule.period_type} ${dir} do vencimento`);
    }
    return parts.length > 0 ? parts.join(" • ") : "Sem filtros";
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-5 w-5 md:h-6 md:w-6" />
            Cobranças Automáticas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure regras para enviar cobranças automaticamente via WhatsApp
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Cobrança
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rules.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Power className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rules.filter((r) => r.is_active).length}</p>
              <p className="text-xs text-muted-foreground">Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <PowerOff className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rules.filter((r) => !r.is_active).length}</p>
              <p className="text-xs text-muted-foreground">Inativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rules.reduce((sum, r) => sum + (r.total_sent || 0), 0)}</p>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Carregando...
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Nenhuma cobrança criada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie sua primeira regra de cobrança automática para começar.
              </p>
            </div>
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Cobrança
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={!rule.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold truncate">{rule.name}</h3>
                      <Badge variant={rule.is_active ? "default" : "secondary"} className="shrink-0">
                        {rule.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {String(rule.send_hour).padStart(2, "0")}:{String(rule.send_minute).padStart(2, "0")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        Delay: {rule.delay_min}s–{rule.delay_max}s
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {getFilterLabel(rule)}
                      </span>
                      {rule.last_run_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Último envio: {format(new Date(rule.last_run_at), "dd/MM HH:mm", { locale: ptBR })}
                          {" "}({rule.last_run_count || 0} msgs)
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Total: {rule.total_sent || 0} enviadas
                      </span>
                    </div>

                    {/* Message preview */}
                    <div className="rounded-md bg-muted/50 border p-2 text-xs text-muted-foreground line-clamp-2">
                      {rule.message_template || "Sem mensagem configurada"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggle(rule)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(rule.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <BillingRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        clients={clients || []}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cobrança?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. A regra de cobrança será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BillingRules;
