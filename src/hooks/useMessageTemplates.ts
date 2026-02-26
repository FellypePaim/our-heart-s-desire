import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const DEFAULT_TEMPLATES: Record<string, string> = {
  // === Pré-vencimento ===
  pre3_reminder:
`Olá {nome}! 👋

Seu plano *{plano}* no servidor *{servidor}* vence em *3 dias* ({vencimento}).

Renove agora e mantenha o acesso sem cortes!

💰 Valor: R$ {valor}
👤 Usuário: {usuario}
🔑 Senha: {senha}

➡ Chave PIX: {pix}

🎁 Promoção ativa: Indique um amigo e ganhe 1 mês grátis!

Agradecemos a preferência! 💚`,

  pre2_reminder:
`Oi {nome}, atenção! ⚠️

Faltam apenas *2 dias* para o vencimento do seu plano *{plano}* no servidor *{servidor}* ({vencimento}).

Garanta sua renovação para não perder o acesso!

💰 Valor: R$ {valor}
👤 Usuário: {usuario}
🔑 Senha: {senha}

➡ Chave PIX: {pix}

🎁 Promoção ativa: Indique um amigo e ganhe 1 mês grátis!

Agradecemos a preferência! 💚`,

  pre1_reminder:
`⚠️ {nome}, atenção!

Seu plano *{plano}* no servidor *{servidor}* vence *AMANHÃ* ({vencimento}).

Renove agora para continuar usando o serviço sem interrupção!

💰 Valor: R$ {valor}
👤 Usuário: {usuario}
🔑 Senha: {senha}

➡ Chave PIX: {pix}

🎁 Promoção ativa: Indique um amigo e ganhe 1 mês grátis!

Agradecemos a preferência! 💚`,

  // === Vencimento no dia ===
  today_urgent:
`⏰ Olá {nome}, atenção!

Hoje {vencimento} é o *vencimento do seu plano* {plano} no servidor *{servidor}* 📺

Renove agora e mantenha o acesso sem cortes!

💰 Valor: R$ {valor}
👤 Usuário: {usuario}
🔑 Senha: {senha}

➡ Chave PIX: {pix}

🎁 Promoção ativa: Indique um amigo e ganhe 1 mês grátis!

Agradecemos a preferência! 💚`,

  // === Pós-vencimento ===
  post1_charge:
`❗ {nome}, seu plano *{plano}* no servidor *{servidor}* venceu *ontem*.

Regularize sua situação para evitar o bloqueio do acesso!

💰 Valor: R$ {valor}
👤 Usuário: {usuario}
🔑 Senha: {senha}

➡ Chave PIX: {pix}

Agradecemos a preferência! 💚`,

  post2_charge:
`⛔ {nome}, seu plano *{plano}* no servidor *{servidor}* está vencido há *2 dias*.

Entre em contato urgente para regularizar e evitar o cancelamento!

💰 Valor: R$ {valor}
👤 Usuário: {usuario}
🔑 Senha: {senha}

➡ Chave PIX: {pix}

Agradecemos a preferência! 💚`,

  expired_final:
`🔴 {nome}, seu plano *{plano}* no servidor *{servidor}* está *vencido* desde {vencimento}.

Este é o *último aviso* antes do cancelamento definitivo. Regularize agora!

💰 Valor: R$ {valor}
👤 Usuário: {usuario}
🔑 Senha: {senha}

➡ Chave PIX: {pix}`,

  // === Extras ===
  renewal_confirmed:
`{nome} recebemos o pagamento da sua assinatura com sucesso! 🎉

🔑 Seus dados de acesso foram ativados no *{servidor}*

👤 Usuário: {usuario}
🔑 Senha: {senha}

Novo vencimento: *{vencimento}*

🎁 Promoção ativa: Indique um amigo e ganhe 1 mês grátis!

Agradecemos a preferência! 💚`,

  test_activated:
`🎉 {nome}, seu período de teste foi ativado com sucesso!

📺 Plano: *{plano}*
🖥️ Servidor: *{servidor}*
👤 Usuário: {usuario}
🔑 Senha: {senha}

Aproveite até *{vencimento}*!

Qualquer dúvida, estamos à disposição. 💚`,

  welcome_new:
`Olá {nome}, seja bem-vindo(a)! 🎉

Seus dados de acesso ao servidor *{servidor}* estão prontos:

📺 Plano: *{plano}*
👤 Usuário: {usuario}
🔑 Senha: {senha}
📱 Aplicativo: {app}
📡 Telas: {telas}

Vencimento: *{vencimento}*

💰 Valor mensal: R$ {valor}

Qualquer dúvida, estamos à disposição. 💚`,

  suspended_notice:
`⚠️ {nome}, seu acesso ao servidor *{servidor}* foi *suspenso* por falta de pagamento.

Para reativar, regularize sua situação:

💰 Valor: R$ {valor}
➡ Chave PIX: {pix}

Após o pagamento, envie o comprovante para reativarmos seu acesso.`,
};

export const TEMPLATE_VARIABLES = [
  { key: "{nome}", label: "Nome do cliente", example: "João Silva" },
  { key: "{plano}", label: "Plano do cliente", example: "Premium" },
  { key: "{vencimento}", label: "Data de vencimento", example: "15/02/2026" },
  { key: "{valor}", label: "Valor do plano", example: "30,00" },
  { key: "{servidor}", label: "Nome do servidor", example: "BRAVE" },
  { key: "{usuario}", label: "Usuário/Login", example: "3126949777" },
  { key: "{senha}", label: "Senha", example: "5980102915" },
  { key: "{app}", label: "Aplicativo", example: "IPTV Smarters" },
  { key: "{telas}", label: "Qtd. de telas", example: "1" },
  { key: "{pix}", label: "Chave PIX", example: "seupix@email.com" },
];

export const EXTRA_TEMPLATE_KEYS = [
  { key: "renewal_confirmed", label: "✅ Renovação Confirmada", description: "Enviado automaticamente após confirmação de pagamento" },
  { key: "test_activated", label: "🎉 Teste Liberado", description: "Enviado quando um período de teste é ativado" },
  { key: "welcome_new", label: "👋 Boas-vindas", description: "Enviado ao cadastrar um novo cliente" },
  { key: "suspended_notice", label: "⚠️ Aviso de Suspensão", description: "Enviado quando o acesso é suspenso" },
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
