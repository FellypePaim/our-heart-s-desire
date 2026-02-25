import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate } from "@/lib/status";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DailyTipsPopoverProps {
  clients: Client[];
}

type Tip = { emoji: string; text: string };

function generateTips(clients: Client[]): Tip[] {
  const tips: Tip[] = [];
  const now = new Date();
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

  if (expiringSoon.length > 0) {
    tips.push({
      emoji: "⏰",
      text: `${expiringSoon.length} cliente${expiringSoon.length > 1 ? "s" : ""} vencendo em breve. Garanta a renovação!`,
    });
  }
  if (expired.length > 0) {
    const revenueAtRisk = expired.reduce((s, c) => s + (c.valor ?? 0), 0);
    tips.push({
      emoji: "🚨",
      text: `${expired.length} vencido${expired.length > 1 ? "s" : ""} — R$ ${revenueAtRisk.toFixed(2)} em risco.`,
    });
  }
  if (noPhone.length > 0) {
    tips.push({ emoji: "📱", text: `${noPhone.length} sem telefone cadastrado.` });
  }
  if (suspended.length > 0) {
    tips.push({ emoji: "⚠️", text: `${suspended.length} cliente${suspended.length > 1 ? "s" : ""} suspenso${suspended.length > 1 ? "s" : ""}.` });
  }
  if (total > 0) {
    const avgTicket = revenue / total;
    tips.push({ emoji: "💰", text: `Ticket médio: R$ ${avgTicket.toFixed(2)}` });
  }
  if (total > 5) {
    const churnRate = ((expired.length / total) * 100).toFixed(1);
    tips.push({ emoji: "📊", text: `Taxa de churn: ${churnRate}%` });
  }

  const generalTips: Tip[] = [
    { emoji: "💬", text: "Configure templates para cobranças automáticas via WhatsApp." },
    { emoji: "🔄", text: "Use renovação em lote para agilizar múltiplos clientes." },
    { emoji: "📈", text: "Acompanhe Churn & Retenção regularmente." },
  ];

  const dataTips = tips.slice(0, 3);
  const remaining = 3 - dataTips.length;
  const daySeed = Math.floor(now.getTime() / 86400000);
  const shuffled = generalTips.sort(() => 0.5 - Math.sin(daySeed));

  return [...dataTips, ...shuffled.slice(0, remaining)].slice(0, 3);
}

export function DailyTipsPopover({ clients }: DailyTipsPopoverProps) {
  const tips = useMemo(() => generateTips(clients), [clients]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 relative" title="Dicas do dia">
          <Lightbulb className="h-4 w-4" />
          {tips.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
              {tips.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Dicas do dia</h3>
        </div>
        <div className="p-2 space-y-1">
          {tips.map((tip, i) => (
            <div key={i} className="flex gap-3 items-start rounded-lg p-2.5 hover:bg-muted/50 transition-colors">
              <span className="text-base shrink-0">{tip.emoji}</span>
              <p className="text-sm text-muted-foreground leading-snug">{tip.text}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
