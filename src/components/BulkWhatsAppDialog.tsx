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
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Users, MessageSquare, ExternalLink } from "lucide-react";
import { Client } from "@/lib/supabase-types";
import { getAllStatuses, getStatusFromDate, StatusKey } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useAuth } from "@/hooks/useAuth";
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

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const allStatuses = getAllStatuses();

  // Clients grouped by status with phone
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
    for (const client of eligibleClients) {
      const message = fillTemplate(templateText, client);
      const cleanPhone = client.phone!.replace(/\D/g, "");
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, "_blank");

      // Log each message
      if (user) {
        try {
          await supabase.from("message_logs").insert({
            user_id: user.id,
            client_id: client.id,
            status_at_send: selectedStatus,
            template_used: templateKey || "bulk",
            delivery_status: "sent",
          });
        } catch (e) {
          console.error("Erro ao registrar log", e);
        }
      }

      count++;
      setSentCount(count);

      // Small delay between opens to avoid browser blocking
      if (count < eligibleClients.length) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    if (user) {
      await logAudit(user.id, "bulk_message_sent", "client", undefined, {
        status: selectedStatus,
        count,
      });
    }

    toast.success(`${count} mensagens enviadas via WhatsApp!`);
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
                {!templateKey && (
                  <p className="text-xs text-muted-foreground">
                    Status "Ativo" não possui template padrão. Configure um na página de Mensagens.
                  </p>
                )}
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
              <Send className="h-4 w-4" />
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
              Serão abertas <strong>{eligibleClients.length}</strong> janelas do WhatsApp com a
              mensagem do template <strong>"{statusConfig?.label}"</strong>. Cada mensagem será
              personalizada com os dados do cliente. Deseja continuar?
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
