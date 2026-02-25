import { useState, useEffect, useMemo } from "react";
import { Lightbulb, RefreshCw } from "lucide-react";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate } from "@/lib/status";

interface DailyTipsProps {
  clients: Client[];
}

type Tip = { emoji: string; text: string };

function generateTips(clients: Client[]): Tip[] {
  const tips: Tip[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const total = clients.length;
  const expiringSoon = clients.filter((c) => {
    const s = getStatusFromDate(c.expiration_date);
    return ["pre3", "pre2", "pre1", "today"].includes(s.key) && !c.is_suspended;
  });
  const expired = clients.filter((c) => {
    const s = getStatusFromDate(c.expiration_date);
    return ["post1", "post2", "expired"].includes(s.key) && !c.is_suspended;
  });
  const suspended = clients.filter((c) => c.is_suspended);
  const noPhone = clients.filter((c) => !c.phone || c.phone.trim() === "");
  const revenue = clients.reduce((sum, c) => sum + (c.valor ?? 0), 0);

  // Expiring soon tips
  if (expiringSoon.length > 0) {
    tips.push({
      emoji: "⏰",
      text: `Você tem ${expiringSoon.length} cliente${expiringSoon.length > 1 ? "s" : ""} vencendo nos próximos dias. Entre em contato para garantir a renovação!`,
    });
  }

  // Expired tips
  if (expired.length > 0) {
    const revenueAtRisk = expired.reduce((s, c) => s + (c.valor ?? 0), 0);
    tips.push({
      emoji: "🚨",
      text: `${expired.length} cliente${expired.length > 1 ? "s" : ""} já venceu${expired.length > 1 ? "ram" : ""}. Isso representa R$ ${revenueAtRisk.toFixed(2)} em risco. Priorize a reativação!`,
    });
  }

  // No phone tips
  if (noPhone.length > 0) {
    tips.push({
      emoji: "📱",
      text: `${noPhone.length} cliente${noPhone.length > 1 ? "s" : ""} sem telefone cadastrado. Preencha para facilitar cobranças via WhatsApp.`,
    });
  }

  // Suspended
  if (suspended.length > 0) {
    tips.push({
      emoji: "⚠️",
      text: `Existem ${suspended.length} cliente${suspended.length > 1 ? "s" : ""} suspensos. Verifique se algum pode ser reativado.`,
    });
  }

  // Revenue insight
  if (total > 0) {
    const avgTicket = revenue / total;
    tips.push({
      emoji: "💰",
      text: `Seu ticket médio é R$ ${avgTicket.toFixed(2)}. Considere oferecer upgrades para clientes com planos mais baratos.`,
    });
  }

  // Growth tip
  if (total === 0) {
    tips.push({
      emoji: "🚀",
      text: "Comece adicionando seus primeiros clientes! Use o botão '+ Novo Cliente' acima.",
    });
  }

  // Churn rate tip
  if (total > 5) {
    const churnRate = ((expired.length / total) * 100).toFixed(1);
    tips.push({
      emoji: "📊",
      text: `Taxa de churn atual: ${churnRate}%. ${Number(churnRate) > 10 ? "Está acima do ideal (10%). Foque em reter os clientes que estão vencendo." : "Está dentro de um bom padrão. Continue assim!"}`,
    });
  }

  // Seasonal tip
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 1) {
    tips.push({
      emoji: "📅",
      text: "Início de semana é o melhor momento para cobrar vencimentos. Envie lembretes de renovação hoje!",
    });
  }

  // Best practice tips pool
  const generalTips: Tip[] = [
    { emoji: "💬", text: "Configure templates de mensagem para agilizar cobranças automáticas via WhatsApp." },
    { emoji: "🎯", text: "Clientes com mais de 2 telas tendem a renovar mais. Use isso como argumento de venda." },
    { emoji: "🔄", text: "Use a renovação em lote para agilizar a renovação de múltiplos clientes de uma vez." },
    { emoji: "📈", text: "Acompanhe a aba de Churn & Retenção regularmente para identificar tendências." },
    { emoji: "🏷️", text: "Mantenha os dados de servidor e aplicativo atualizados para facilitar o suporte técnico." },
  ];

  // Mix data-driven and general tips
  const dataTips = tips.slice(0, 2);
  const remaining = 3 - dataTips.length;

  // Use date as seed for consistent daily rotation of general tips
  const daySeed = Math.floor(now.getTime() / 86400000);
  const shuffled = generalTips.sort(() => 0.5 - Math.sin(daySeed));
  const fillers = shuffled.slice(0, remaining);

  return [...dataTips, ...fillers].slice(0, 3);
}

export function DailyTips({ clients }: DailyTipsProps) {
  const tips = useMemo(() => generateTips(clients), [clients]);

  if (tips.length === 0) return null;

  return (
    <div className="mx-4 md:mx-6 mt-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Dicas do dia</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tips.map((tip, i) => (
          <div
            key={i}
            className="flex gap-3 items-start rounded-lg bg-muted/50 p-3 animate-fade-in"
            style={{ animationDelay: `${i * 150}ms`, animationFillMode: "backwards" }}
          >
            <span className="text-lg shrink-0">{tip.emoji}</span>
            <p className="text-sm text-muted-foreground leading-relaxed">{tip.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
