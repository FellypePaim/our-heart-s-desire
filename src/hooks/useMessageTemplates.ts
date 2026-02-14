import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const DEFAULT_TEMPLATES: Record<string, string> = {
  pre3_reminder:
    "Olá {nome}! 👋 Seu plano *{plano}* vence em *3 dias* ({vencimento}). Renove agora para não perder o acesso!",
  pre2_reminder:
    "Oi {nome}, lembrete: seu plano *{plano}* vence em *2 dias* ({vencimento}). Garanta sua renovação! 🔔",
  pre1_reminder:
    "⚠️ {nome}, seu plano *{plano}* vence *amanhã* ({vencimento})! Renove agora para continuar usando o serviço.",
  today_urgent:
    "🚨 {nome}, seu plano *{plano}* vence *HOJE* ({vencimento})! Renove imediatamente para evitar a suspensão.",
  post1_charge:
    "❗ {nome}, seu plano *{plano}* venceu *ontem*. Regularize sua situação o quanto antes para evitar o bloqueio.",
  post2_charge:
    "⛔ {nome}, seu plano *{plano}* está vencido há *2 dias*. Entre em contato urgente para regularizar.",
  expired_final:
    "🔴 {nome}, seu plano *{plano}* está *vencido* desde {vencimento}. Este é o último aviso antes do cancelamento definitivo.",
  renewal_confirmed:
    "✅ {nome}, sua renovação do plano *{plano}* foi confirmada! Novo vencimento: {vencimento}. Obrigado!",
  test_activated:
    "🎉 {nome}, seu período de teste do plano *{plano}* foi ativado! Aproveite até {vencimento}.",
};

export const TEMPLATE_VARIABLES = [
  { key: "{nome}", label: "Nome do cliente", example: "João Silva" },
  { key: "{plano}", label: "Plano do cliente", example: "Premium" },
  { key: "{vencimento}", label: "Data de vencimento", example: "15/02/2026" },
];

export const EXTRA_TEMPLATE_KEYS = [
  { key: "renewal_confirmed", label: "Renovação Confirmada", description: "Enviado automaticamente após renovação" },
  { key: "test_activated", label: "Teste Liberado", description: "Enviado quando um teste é ativado" },
];

interface SavedTemplate {
  id: string;
  status_key: string;
  template_text: string;
}

export function useMessageTemplates() {
  const { user } = useAuth();
  const [savedTemplates, setSavedTemplates] = useState<Record<string, SavedTemplate>>({});
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("message_templates")
      .select("id, status_key, template_text")
      .eq("user_id", user.id);

    if (!error && data) {
      const map: Record<string, SavedTemplate> = {};
      data.forEach((t) => {
        map[t.status_key] = t;
      });
      setSavedTemplates(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const saveTemplate = async (statusKey: string, text: string) => {
    if (!user) return;
    const existing = savedTemplates[statusKey];

    if (existing) {
      const { error } = await supabase
        .from("message_templates")
        .update({ template_text: text })
        .eq("id", existing.id);
      if (error) {
        toast.error("Erro ao salvar template");
        return;
      }
    } else {
      const { error } = await supabase
        .from("message_templates")
        .insert({ user_id: user.id, status_key: statusKey, template_text: text });
      if (error) {
        toast.error("Erro ao salvar template");
        return;
      }
    }

    toast.success("Template salvo com sucesso!");
    await fetchTemplates();
  };

  const resetTemplate = async (statusKey: string) => {
    if (!user) return;
    const existing = savedTemplates[statusKey];
    if (existing) {
      await supabase.from("message_templates").delete().eq("id", existing.id);
      await fetchTemplates();
      toast.success("Template resetado para o padrão");
    }
  };

  const getTemplate = (statusKey: string): string => {
    return savedTemplates[statusKey]?.template_text ?? DEFAULT_TEMPLATES[statusKey] ?? "";
  };

  const isCustom = (statusKey: string): boolean => {
    return !!savedTemplates[statusKey];
  };

  return { loading, getTemplate, saveTemplate, resetTemplate, isCustom };
}
