import { useState, useMemo, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Users, Filter, Settings, Save, Eye } from "lucide-react";
import { Client } from "@/lib/supabase-types";
import { getAllStatuses, getStatusFromDate, StatusKey } from "@/lib/status";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { toast } from "sonner";
import { format, differenceInDays, startOfDay, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface BillingRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: BillingRule | null;
  clients: Client[];
}

export function BillingRuleDialog({ open, onOpenChange, rule, clients }: BillingRuleDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { getTemplate } = useMessageTemplates();
  const allStatuses = getAllStatuses();

  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("config");

  // Form state
  const [name, setName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [selectedMessage, setSelectedMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [billingType, setBillingType] = useState("vencimento");
  const [periodType, setPeriodType] = useState("dias");
  const [periodValue, setPeriodValue] = useState(0);
  const [periodDirection, setPeriodDirection] = useState("before");
  const [delayMin, setDelayMin] = useState(3);
  const [delayMax, setDelayMax] = useState(7);
  const [sendHour, setSendHour] = useState(9);
  const [sendMinute, setSendMinute] = useState(0);

  // Populate form when editing
  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setMessageTemplate(rule.message_template);
      setStatusFilter(rule.status_filter || []);
      setBillingType(rule.billing_type);
      setPeriodType(rule.period_type);
      setPeriodValue(rule.period_value);
      setPeriodDirection(rule.period_direction);
      setDelayMin(Math.max(3, rule.delay_min));
      setDelayMax(Math.max(rule.delay_max, Math.max(3, rule.delay_min)));
      setSendHour(rule.send_hour);
      setSendMinute(rule.send_minute);
      setSelectedMessage("");
    } else {
      setName("");
      setMessageTemplate("");
      setSelectedMessage("");
      setStatusFilter([]);
      setBillingType("vencimento");
      setPeriodType("dias");
      setPeriodValue(0);
      setPeriodDirection("before");
      setDelayMin(3);
      setDelayMax(7);
      setSendHour(9);
      setSendMinute(0);
    }
    setTab("config");
  }, [rule, open]);

  // Filter matching clients for preview
  const matchingClients = useMemo(() => {
    if (!clients) return [];

    return clients.filter((c) => {
      if (!c.phone) return false;

      // Status filter
      if (statusFilter.length > 0) {
        const clientStatus = getStatusFromDate(c.expiration_date);
        if (!statusFilter.includes(clientStatus.key)) return false;
      }

      // Period filter
      if (periodValue > 0) {
        const today = startOfDay(new Date());
        const [year, month, day] = c.expiration_date.split("T")[0].split("-").map(Number);
        const expDate = startOfDay(new Date(year, month - 1, day));
        const diff = differenceInDays(expDate, today);

        let multiplier = 1;
        if (periodType === "horas") multiplier = 1 / 24;
        if (periodType === "semanas") multiplier = 7;
        if (periodType === "meses") multiplier = 30;

        const targetDiff = periodValue * multiplier;

        if (periodDirection === "before") {
          // Client expires in X days
          if (diff > targetDiff || diff < 0) return false;
        } else {
          // Client expired X days ago
          if (diff > 0 || Math.abs(diff) > targetDiff) return false;
        }
      }

      return true;
    });
  }, [clients, statusFilter, periodValue, periodType, periodDirection]);

  const handleSelectTemplate = (key: string) => {
    setSelectedMessage(key);
    const templateText = getTemplate(key);
    setMessageTemplate(templateText);
  };

  const toggleStatus = (key: string) => {
    setStatusFilter((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const fillPreview = (text: string, client: Client) => {
    const [y, m, d] = client.expiration_date.split("T")[0].split("-").map(Number);
    const expFormatted = format(new Date(y, m - 1, d), "dd/MM/yyyy", { locale: ptBR });
    return text
      .replace(/\{nome\}/g, client.name)
      .replace(/\{plano\}/g, client.plan || "Sem plano")
      .replace(/\{vencimento\}/g, expFormatted);
  };

  const handleSave = async () => {
    if (!user || !name.trim()) {
      toast.error("Preencha o nome da cobrança");
      return;
    }
    if (!messageTemplate.trim()) {
      toast.error("Configure a mensagem da cobrança");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: name.trim(),
        message_template: messageTemplate,
        status_filter: statusFilter,
        billing_type: billingType,
        period_type: periodType,
        period_value: periodValue,
        period_direction: periodDirection,
        delay_min: delayMin,
        delay_max: delayMax,
        send_hour: sendHour,
        send_minute: sendMinute,
      };

      if (rule) {
        const { error } = await supabase
          .from("billing_rules")
          .update(payload)
          .eq("id", rule.id);
        if (error) throw error;
        toast.success("Cobrança atualizada!");
      } else {
        const { error } = await supabase
          .from("billing_rules")
          .insert(payload);
        if (error) throw error;
        toast.success("Cobrança criada!");
      }

      queryClient.invalidateQueries({ queryKey: ["billing_rules"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {rule ? "Editar Cobrança" : "Nova Cobrança"}
          </DialogTitle>
          <DialogDescription>
            Configure os filtros e a mensagem para envio automático.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="filters" className="gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Filtros
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Preview
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                {matchingClients.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ---- CONFIGURAÇÃO ---- */}
          <TabsContent value="config" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome para identificação"
                />
              </div>
              <div className="space-y-2">
                <Label>Template de mensagem</Label>
                <Select value={selectedMessage} onValueChange={handleSelectTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allStatuses
                      .filter((s) => s.templateKey)
                      .map((s) => (
                        <SelectItem key={s.templateKey!} value={s.templateKey!}>
                          {s.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Digite a mensagem ou selecione um template acima..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: <code className="text-primary">{"{nome}"}</code>,{" "}
                <code className="text-primary">{"{plano}"}</code>,{" "}
                <code className="text-primary">{"{vencimento}"}</code>
              </p>
            </div>

            {/* Delay */}
            <div className="space-y-2">
              <Label className="text-sm">Intervalo aleatório entre cada envio (segundos)</Label>
              <p className="text-xs text-muted-foreground">
                Mínimo de 3 segundos para evitar bloqueio por spam no WhatsApp.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Intervalo Mínimo</Label>
                  <Input
                    type="number"
                    min={3}
                    value={delayMin}
                    onChange={(e) => {
                      const val = Math.max(3, Number(e.target.value));
                      setDelayMin(val);
                      if (delayMax < val) setDelayMax(val);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Intervalo Máximo</Label>
                  <Input
                    type="number"
                    min={delayMin}
                    value={delayMax}
                    onChange={(e) => setDelayMax(Math.max(delayMin, Number(e.target.value)))}
                  />
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label className="text-sm">Horário de envio</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Hora</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={sendHour}
                    onChange={(e) => setSendHour(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Minuto</Label>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={sendMinute}
                    onChange={(e) => setSendMinute(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ---- FILTROS ---- */}
          <TabsContent value="filters" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Tipo de cobrança</Label>
              <Select value={billingType} onValueChange={setBillingType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vencimento">Vencimento</SelectItem>
                  <SelectItem value="renovacao">Renovação</SelectItem>
                  <SelectItem value="aviso">Aviso Geral</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Cada tipo de cobrança tem um foco diferente.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Situação do cliente</Label>
              <div className="grid grid-cols-2 gap-2">
                {allStatuses.map((s) => (
                  <label
                    key={s.key}
                    className="flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={statusFilter.includes(s.key)}
                      onCheckedChange={() => toggleStatus(s.key)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.label}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Filtra clientes pela situação atual. Deixe vazio para incluir todos.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo período</Label>
                <Select value={periodType} onValueChange={setPeriodType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dias">Dias</SelectItem>
                    <SelectItem value="horas">Horas</SelectItem>
                    <SelectItem value="semanas">Semanas</SelectItem>
                    <SelectItem value="meses">Meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor do período</Label>
                <Input
                  type="number"
                  min={0}
                  value={periodValue}
                  onChange={(e) => setPeriodValue(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">0 = sem filtro de período</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Direção</Label>
              <Select value={periodDirection} onValueChange={setPeriodDirection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Antes do vencimento</SelectItem>
                  <SelectItem value="after">Depois do vencimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* ---- PREVIEW ---- */}
          <TabsContent value="preview" className="space-y-4 mt-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-center space-y-1">
              <p className="text-3xl font-bold">{matchingClients.length}</p>
              <p className="text-sm text-muted-foreground">
                cliente{matchingClients.length !== 1 ? "s" : ""} encontrado{matchingClients.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {matchingClients.filter((c) => c.phone).length} com telefone
              </p>
            </div>

            {/* Message preview */}
            {messageTemplate && matchingClients[0] && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Preview da mensagem
                  <Badge variant="outline" className="text-xs">
                    {matchingClients[0].name}
                  </Badge>
                </Label>
                <div className="rounded-lg bg-muted/60 border p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {fillPreview(messageTemplate, matchingClients[0])}
                </div>
              </div>
            )}

            {/* Client list */}
            {matchingClients.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Clientes que receberão ({matchingClients.length})
                </Label>
                <ScrollArea className="h-48 rounded-lg border">
                  <div className="p-2 space-y-1">
                    {matchingClients.map((c) => {
                      const status = getStatusFromDate(c.expiration_date);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{c.name}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {status.label}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono shrink-0">
                            {c.phone || "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {matchingClients.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhum cliente corresponde aos filtros configurados.
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end gap-2 pt-2 border-t mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : rule ? "Atualizar" : "Criar Cobrança"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
