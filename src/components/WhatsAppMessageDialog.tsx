import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, FileText, PenLine, Zap, ExternalLink } from "lucide-react";
import { Client } from "@/lib/supabase-types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getStatusFromDate } from "@/lib/status";
import {
  useMessageTemplates,
  EXTRA_TEMPLATE_KEYS,
} from "@/hooks/useMessageTemplates";
import { getAllStatuses } from "@/lib/status";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { toast } from "sonner";

interface WhatsAppMessageDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppMessageDialog({ client, open, onOpenChange }: WhatsAppMessageDialogProps) {
  const { user } = useAuth();
  const { getTemplate, loading: templatesLoading } = useMessageTemplates();
  const { hasInstance, sendViaApi } = useWhatsAppInstance();

  const [mode, setMode] = useState<"template" | "custom">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [customText, setCustomText] = useState("");
  const [sendMethod, setSendMethod] = useState<"manual" | "api">("manual");
  const [sending, setSending] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile_pix", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("pix_key").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const allStatuses = getAllStatuses();

  const templateOptions = useMemo(() => {
    const statusTemplates = allStatuses
      .filter((s) => s.templateKey)
      .map((s) => ({ key: s.templateKey!, label: s.label, description: s.description }));
    const extraTemplates = EXTRA_TEMPLATE_KEYS.map((t) => ({ key: t.key, label: t.label, description: t.description }));
    return [...statusTemplates, ...extraTemplates];
  }, [allStatuses]);

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
      .replace(/\{vencimento\}/g, expirationFormatted)
      .replace(/\{valor\}/g, client.valor ? String(client.valor).replace(".", ",") : "0,00")
      .replace(/\{servidor\}/g, client.servidor || "—")
      .replace(/\{usuario\}/g, (client as any).login || client.phone || "—")
      .replace(/\{senha\}/g, (client as any).senha || "—")
      .replace(/\{app\}/g, client.aplicativo || "—")
      .replace(/\{telas\}/g, String(client.telas || 1))
      .replace(/\{pix\}/g, (client as any).pix || (profile as any)?.pix_key || "—");
  };

  const previewMessage = useMemo(() => {
    if (mode === "custom") return fillTemplate(customText);
    if (!selectedTemplate) return "";
    return fillTemplate(getTemplate(selectedTemplate));
  }, [mode, selectedTemplate, customText, client, getTemplate]);

  const handleSend = async () => {
    if (!client?.phone || !previewMessage.trim()) return;
    setSending(true);

    try {
      const status = getStatusFromDate(client.expiration_date);

      if (sendMethod === "api") {
        await sendViaApi(client.phone, previewMessage);
        toast.success("Mensagem enviada via API WhatsApp!");
      } else {
        const cleanPhone = client.phone.replace(/\D/g, "");
        const encodedMessage = encodeURIComponent(previewMessage);
        window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, "_blank");
        toast.success("Mensagem aberta no WhatsApp!");
      }

      if (user) {
        await supabase.from("message_logs").insert({
          user_id: user.id,
          client_id: client.id,
          status_at_send: status.key,
          template_used: mode === "template" ? selectedTemplate : "custom",
          delivery_status: sendMethod === "api" ? "sent_api" : "sent",
        });
      }

      onOpenChange(false);
      setSelectedTemplate("");
      setCustomText("");
      setMode("template");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  if (!client) return null;

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
                {previewMessage}
              </div>
            </div>
          )}

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={sending || !previewMessage.trim()}
            className="w-full gap-2"
          >
            {sendMethod === "api" ? <Zap className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {sending ? "Enviando..." : sendMethod === "api" ? "Enviar via API" : "Enviar via WhatsApp"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
