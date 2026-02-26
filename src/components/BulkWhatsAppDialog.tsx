import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Users, Zap, ExternalLink } from "lucide-react";
import { Client } from "@/lib/supabase-types";
import { getAllStatuses, getStatusFromDate, StatusKey } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BulkWhatsAppDialogProps {
  clients: Client[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkWhatsAppDialog({ clients, open, onOpenChange }: BulkWhatsAppDialogProps) {
  const { user } = useAuth();
  const { getTemplate, loading: templatesLoading } = useMessageTemplates();
  const { hasInstance, sendViaApi } = useWhatsAppInstance();

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [sendMethod, setSendMethod] = useState<"manual" | "api">("manual");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const allStatuses = getAllStatuses();

  const clientsByStatus = useMemo(() => {
    const map = new Map<StatusKey, Client[]>();
    clients?.forEach((c) => {
      if (!c.phone) return;
      const status = getStatusFromDate(c.expiration_date);
      const list = map.get(status.key) || [];
      list.push(c);
      map.set(status.key, list);
    });
    return map;
  }, [clients]);

  const eligibleClients = selectedStatus
    ? clientsByStatus.get(selectedStatus as StatusKey) || []
    : [];

  const statusConfig = selectedStatus
    ? allStatuses.find((s) => s.key === selectedStatus)
    : null;

  const templateKey = statusConfig?.templateKey;
  const templateText = templateKey ? getTemplate(templateKey) : "";

  const fillTemplate = (text: string, client: Client): string => {
    const expirationFormatted = format(
      new Date(client.expiration_date + "T12:00:00"),
      "dd/MM/yyyy",
      { locale: ptBR }
    );
    return text
      .replace(/\{nome\}/g, client.name)
      .replace(/\{plano\}/g, client.plan || "Sem plano")
      .replace(/\{vencimento\}/g, expirationFormatted);
  };

  const handleStartSend = () => {
    if (eligibleClients.length === 0 || !templateText) return;
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    setSentCount(0);

    let count = 0;
    let errorCount = 0;

    for (const client of eligibleClients) {
      const message = fillTemplate(templateText, client);

      try {
        if (sendMethod === "api") {
          await sendViaApi(client.phone!, message);
        } else {
          const cleanPhone = client.phone!.replace(/\D/g, "");
          const encodedMessage = encodeURIComponent(message);
          window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, "_blank");
        }

        if (user) {
          await supabase.from("message_logs").insert({
            user_id: user.id,
            client_id: client.id,
            status_at_send: selectedStatus,
            template_used: templateKey || "bulk",
            delivery_status: sendMethod === "api" ? "sent_api" : "sent",
          });
        }
      } catch (e) {
        errorCount++;
        console.error("Erro ao enviar para", client.name, e);
      }

      count++;
      setSentCount(count);

      if (count < eligibleClients.length) {
        // Delay aleatório entre 3-7s (API) ou 1-2s (manual) para evitar ban por spam
        const minDelay = sendMethod === "api" ? 3000 : 1000;
        const maxDelay = sendMethod === "api" ? 7000 : 2000;
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    if (user) {
      await logAudit(user.id, "bulk_message_sent", "client", undefined, {
        status: selectedStatus,
        count: count - errorCount,
        errors: errorCount,
        sendMethod,
      });
    }

    if (errorCount > 0) {
      toast.warning(`${count - errorCount} enviadas, ${errorCount} falharam.`);
    } else {
      toast.success(`${count} mensagens enviadas${sendMethod === "api" ? " via API" : " via WhatsApp"}!`);
    }

    setSending(false);
    setSentCount(0);
    onOpenChange(false);
    setSelectedStatus("");
  };

  const handleClose = (value: boolean) => {
    if (sending) return;
    onOpenChange(value);
    if (!value) {
      setSelectedStatus("");
      setSentCount(0);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Envio em Massa — WhatsApp
            </DialogTitle>
            <DialogDescription>
              Selecione um status para enviar a mensagem correspondente a todos os clientes com telefone cadastrado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Send Method */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Método de envio</Label>
              <div className="flex gap-2">
                <Button
                  variant={sendMethod === "manual" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => setSendMethod("manual")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Manual (wa.me)
                </Button>
                <Button
                  variant={sendMethod === "api" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => setSendMethod("api")}
                  disabled={!hasInstance}
                >
                  <Zap className="h-4 w-4" />
                  API (UAZAPI)
                </Button>
              </div>
              {!hasInstance && (
                <p className="text-xs text-muted-foreground">
                  Configure sua instância UAZAPI em Configurações para usar envio via API.
                </p>
              )}
            </div>

            {/* Status selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status dos clientes</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
                <SelectContent>
                  {allStatuses.map((s) => {
                    const count = clientsByStatus.get(s.key)?.length || 0;
                    return (
                      <SelectItem key={s.key} value={s.key} disabled={count === 0}>
                        <span className="flex items-center gap-2">
                          {s.label}
                          <Badge variant="secondary" className="text-xs ml-1">
                            {count}
                          </Badge>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Status info */}
            {statusConfig && (
              <div className="flex items-center gap-2">
                <StatusBadge status={statusConfig} size="sm" />
                <span className="text-sm text-muted-foreground">
                  {eligibleClients.length} cliente{eligibleClients.length !== 1 ? "s" : ""} com telefone
                </span>
              </div>
            )}

            {/* Template preview */}
            {selectedStatus && templateText && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Template que será enviado</Label>
                <div className="rounded-lg bg-muted/60 border p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {templateText}
                </div>
              </div>
            )}

            {selectedStatus && !templateText && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Este status não possui template configurado. Configure um na página de Mensagens.
              </div>
            )}

            {/* Client list preview */}
            {eligibleClients.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Clientes que receberão ({eligibleClients.length})
                </Label>
                <ScrollArea className="h-40 rounded-lg border">
                  <div className="p-2 space-y-1">
                    {eligibleClients.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                      >
                        <span className="font-medium truncate">{c.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {c.phone}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Sending progress */}
            {sending && (
              <div className="rounded-lg bg-muted/60 border p-3 text-sm text-center">
                Enviando... {sentCount} de {eligibleClients.length}
              </div>
            )}

            {/* Send button */}
            <Button
              onClick={handleStartSend}
              disabled={sending || eligibleClients.length === 0 || !templateText}
              className="w-full gap-2"
            >
              {sendMethod === "api" ? <Zap className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {sending
                ? `Enviando ${sentCount}/${eligibleClients.length}...`
                : `Enviar para ${eligibleClients.length} cliente${eligibleClients.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio em massa</AlertDialogTitle>
            <AlertDialogDescription>
              {sendMethod === "api" ? (
                <>Serão enviadas <strong>{eligibleClients.length}</strong> mensagens automaticamente via API UAZAPI com o template <strong>"{statusConfig?.label}"</strong>.</>
              ) : (
                <>Serão abertas <strong>{eligibleClients.length}</strong> janelas do WhatsApp com a mensagem do template <strong>"{statusConfig?.label}"</strong>.</>
              )}
              {" "}Cada mensagem será personalizada com os dados do cliente. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSend}>
              Confirmar e Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
