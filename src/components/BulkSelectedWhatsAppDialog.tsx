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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Send, MessageSquare, FileText, PenLine } from "lucide-react";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate } from "@/lib/status";
import {
  useMessageTemplates,
  EXTRA_TEMPLATE_KEYS,
} from "@/hooks/useMessageTemplates";
import { getAllStatuses } from "@/lib/status";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BulkSelectedWhatsAppDialogProps {
  clients: Client[];
  selectedIds: Set<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkSelectedWhatsAppDialog({ clients, selectedIds, open, onOpenChange }: BulkSelectedWhatsAppDialogProps) {
  const { user } = useAuth();
  const { getTemplate, loading: templatesLoading } = useMessageTemplates();

  const [mode, setMode] = useState<"template" | "custom">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [customText, setCustomText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const allStatuses = getAllStatuses();

  const selectedClients = useMemo(
    () => clients.filter((c) => selectedIds.has(c.id)),
    [clients, selectedIds]
  );

  const eligibleClients = useMemo(
    () => selectedClients.filter((c) => c.phone),
    [selectedClients]
  );

  const withoutPhone = selectedClients.length - eligibleClients.length;

  const templateOptions = useMemo(() => {
    const statusTemplates = allStatuses
      .filter((s) => s.templateKey)
      .map((s) => ({ key: s.templateKey!, label: s.label, description: s.description }));
    const extraTemplates = EXTRA_TEMPLATE_KEYS.map((t) => ({ key: t.key, label: t.label, description: t.description }));
    return [...statusTemplates, ...extraTemplates];
  }, [allStatuses]);

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

  const messageText = useMemo(() => {
    if (mode === "custom") return customText;
    if (!selectedTemplate) return "";
    return getTemplate(selectedTemplate);
  }, [mode, selectedTemplate, customText, getTemplate]);

  const previewClient = eligibleClients[0];
  const previewMessage = previewClient && messageText ? fillTemplate(messageText, previewClient) : "";

  const handleStartSend = () => {
    if (eligibleClients.length === 0 || !messageText.trim()) return;
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    setSentCount(0);

    let count = 0;
    for (const client of eligibleClients) {
      const message = fillTemplate(messageText, client);
      const cleanPhone = client.phone!.replace(/\D/g, "");
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, "_blank");

      if (user) {
        try {
          const status = getStatusFromDate(client.expiration_date);
          await supabase.from("message_logs").insert({
            user_id: user.id,
            client_id: client.id,
            status_at_send: status.key,
            template_used: mode === "template" ? selectedTemplate : "custom",
            delivery_status: "sent",
          });
        } catch (e) {
          console.error("Erro ao registrar log", e);
        }
      }

      count++;
      setSentCount(count);

      if (count < eligibleClients.length) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    if (user) {
      await logAudit(user.id, "bulk_selected_message_sent", "client", undefined, {
        count,
        mode,
        template: mode === "template" ? selectedTemplate : "custom",
      });
    }

    toast.success(`${count} mensagens enviadas via WhatsApp!`);
    setSending(false);
    setSentCount(0);
    onOpenChange(false);
    setSelectedTemplate("");
    setCustomText("");
    setMode("template");
  };

  const handleClose = (value: boolean) => {
    if (sending) return;
    onOpenChange(value);
    if (!value) {
      setSelectedTemplate("");
      setCustomText("");
      setMode("template");
      setSentCount(0);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Enviar para Selecionados
            </DialogTitle>
            <DialogDescription>
              Envie uma mensagem via WhatsApp para os {selectedClients.length} clientes selecionados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Stats */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{eligibleClients.length} com telefone</Badge>
              {withoutPhone > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {withoutPhone} sem telefone (ignorados)
                </Badge>
              )}
            </div>

            {/* Mode Selection */}
            <div className="flex gap-2">
              <Button
                variant={mode === "template" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 flex-1"
                onClick={() => setMode("template")}
              >
                <FileText className="h-4 w-4" />
                Usar Template
              </Button>
              <Button
                variant={mode === "custom" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 flex-1"
                onClick={() => setMode("custom")}
              >
                <PenLine className="h-4 w-4" />
                Texto Livre
              </Button>
            </div>

            {mode === "template" ? (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Selecione o template</Label>
                <ScrollArea className="h-48 rounded-lg border p-2">
                  <RadioGroup value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    {templateOptions.map((t) => (
                      <div
                        key={t.key}
                        className={`flex items-start gap-3 rounded-lg p-2.5 cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedTemplate === t.key ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedTemplate(t.key)}
                      >
                        <RadioGroupItem value={t.key} id={`bulk-sel-${t.key}`} className="mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{t.label}</p>
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </ScrollArea>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sua mensagem</Label>
                <Textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Digite sua mensagem personalizada..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: <code className="text-primary">{"{nome}"}</code>,{" "}
                  <code className="text-primary">{"{plano}"}</code>,{" "}
                  <code className="text-primary">{"{vencimento}"}</code>
                </p>
              </div>
            )}

            {/* Preview */}
            {previewMessage && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Pré-visualização
                  <Badge variant="outline" className="text-xs font-normal">
                    {previewClient?.name}
                  </Badge>
                </Label>
                <div className="rounded-lg bg-muted/60 border p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {previewMessage}
                </div>
              </div>
            )}

            {/* Client list */}
            {eligibleClients.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Destinatários ({eligibleClients.length})
                </Label>
                <ScrollArea className="h-32 rounded-lg border">
                  <div className="p-2 space-y-1">
                    {eligibleClients.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                        <span className="font-medium truncate">{c.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{c.phone}</span>
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
              disabled={sending || eligibleClients.length === 0 || !messageText.trim()}
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

      {/* Confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription>
              Serão abertas <strong>{eligibleClients.length}</strong> janelas do WhatsApp.
              {mode === "template" ? " Cada mensagem será personalizada com os dados do cliente." : " A mensagem digitada será personalizada com as variáveis."}
              {" "}Deseja continuar?
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