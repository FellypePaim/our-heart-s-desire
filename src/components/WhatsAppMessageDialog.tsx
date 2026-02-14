import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, FileText, PenLine } from "lucide-react";
import { Client } from "@/lib/supabase-types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getStatusFromDate } from "@/lib/status";
import {
  useMessageTemplates,
  DEFAULT_TEMPLATES,
  EXTRA_TEMPLATE_KEYS,
} from "@/hooks/useMessageTemplates";
import { getAllStatuses } from "@/lib/status";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface WhatsAppMessageDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppMessageDialog({ client, open, onOpenChange }: WhatsAppMessageDialogProps) {
  const { user } = useAuth();
  const { getTemplate, loading: templatesLoading } = useMessageTemplates();
  const [mode, setMode] = useState<"template" | "custom">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [customText, setCustomText] = useState("");
  const [sending, setSending] = useState(false);

  const allStatuses = getAllStatuses();

  // Build template options
  const templateOptions = useMemo(() => {
    const statusTemplates = allStatuses
      .filter((s) => s.templateKey)
      .map((s) => ({
        key: s.templateKey!,
        label: s.label,
        description: s.description,
      }));

    const extraTemplates = EXTRA_TEMPLATE_KEYS.map((t) => ({
      key: t.key,
      label: t.label,
      description: t.description,
    }));

    return [...statusTemplates, ...extraTemplates];
  }, [allStatuses]);

  // Fill template variables with client data
  const fillTemplate = (text: string): string => {
    if (!client) return text;
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

  const previewMessage = useMemo(() => {
    if (mode === "custom") return customText;
    if (!selectedTemplate) return "";
    const templateText = getTemplate(selectedTemplate);
    return fillTemplate(templateText);
  }, [mode, selectedTemplate, customText, client, getTemplate]);

  const handleSend = async () => {
    if (!client?.phone || !previewMessage.trim()) return;
    setSending(true);

    try {
      // Log message
      if (user) {
        const status = getStatusFromDate(client.expiration_date);
        await supabase.from("message_logs").insert({
          user_id: user.id,
          client_id: client.id,
          status_at_send: status.key,
          template_used: mode === "template" ? selectedTemplate : "custom",
          delivery_status: "sent",
        });
      }

      // Open WhatsApp with the message
      const cleanPhone = client.phone.replace(/\D/g, "");
      const encodedMessage = encodeURIComponent(previewMessage);
      window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, "_blank");

      toast.success("Mensagem enviada via WhatsApp!");
      onOpenChange(false);
      setSelectedTemplate("");
      setCustomText("");
      setMode("template");
    } catch (error: any) {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  if (!client) return null;

  const clientStatus = getStatusFromDate(client.expiration_date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Enviar Mensagem — {client.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
                      <RadioGroupItem value={t.key} id={t.key} className="mt-0.5" />
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
                  {client.name}
                </Badge>
              </Label>
              <div className="rounded-lg bg-muted/60 border p-3 text-sm whitespace-pre-wrap leading-relaxed">
                {mode === "custom" ? fillTemplate(customText) : previewMessage}
              </div>
            </div>
          )}

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={sending || !previewMessage.trim()}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {sending ? "Enviando..." : "Enviar via WhatsApp"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
