import { useMemo } from "react";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate, StatusKey } from "@/lib/status";
import { ShieldAlert, TrendingDown, DollarSign, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskScoreProps {
  clients: Client[];
  onClientClick?: (client: Client) => void;
  mask?: (value: string | null | undefined, type: "phone" | "value" | "email" | "text") => string;
}

interface ClientRisk {
  client: Client;
  score: number;
  level: "critical" | "high" | "medium" | "low";
  factors: string[];
}

const STATUS_RISK_WEIGHT: Record<StatusKey, number> = {
  active: 0, pre3: 10, pre2: 20, pre1: 35,
  today: 50, post1: 65, post2: 80, expired: 95,
};

function calculateRiskScore(client: Client): ClientRisk {
  const status = getStatusFromDate(client.expiration_date);
  const factors: string[] = [];
  let score = 0;

  // 1. Current status weight (0-95)
  const statusWeight = STATUS_RISK_WEIGHT[status.key];
  score += statusWeight * 0.5;
  if (statusWeight >= 50) factors.push(status.label);

  // 2. Value weight — higher value = higher priority (0-25)
  const valor = client.valor || 0;
  if (valor >= 100) { score += 25; factors.push("Alto valor (R$" + valor.toFixed(0) + ")"); }
  else if (valor >= 50) { score += 15; }
  else if (valor >= 20) { score += 8; }
  else { score += 3; }

  // 3. No phone = harder to contact (0-10)
  if (!client.phone) { score += 10; factors.push("Sem telefone cadastrado"); }

  // 4. No payment method info (0-5)
  if (!client.forma_pagamento) { score += 5; factors.push("Pagamento não informado"); }

  // 5. Multiple screens = more at stake (0-10)
  const telas = client.telas || 1;
  if (telas >= 3) { score += 10; factors.push(`${telas} telas contratadas`); }
  else if (telas >= 2) { score += 5; }

  // 6. Suspended account (extra risk flag)
  if (client.is_suspended) { score += 15; factors.push("Conta suspensa"); }

  // Clamp 0-100
  score = Math.min(100, Math.max(0, Math.round(score)));

  const level: ClientRisk["level"] =
    score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : "low";

  return { client, score, level, factors };
}

const LEVEL_CONFIG = {
  critical: {
    label: "Crítico",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    bar: "bg-red-500",
  },
  high: {
    label: "Alto",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    bar: "bg-orange-500",
  },
  medium: {
    label: "Médio",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    bar: "bg-yellow-500",
  },
  low: {
    label: "Baixo",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    bar: "bg-green-500",
  },
};

export function RiskScore({ clients, onClientClick, mask }: RiskScoreProps) {
  const riskedClients = useMemo(() => {
    if (!clients || clients.length === 0) return [];
    return clients
      .map(calculateRiskScore)
      .sort((a, b) => b.score - a.score);
  }, [clients]);

  const summary = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    const revenue = { critical: 0, high: 0, medium: 0, low: 0 };
    riskedClients.forEach((r) => {
      counts[r.level]++;
      revenue[r.level] += r.client.valor || 0;
    });
    return { counts, revenue };
  }, [riskedClients]);

  const formatCurrency = (v: number) =>
    mask ? mask(String(v), "value") : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(["critical", "high", "medium", "low"] as const).map((level) => {
          const config = LEVEL_CONFIG[level];
          return (
            <div key={level} className={cn("rounded-xl border p-4 space-y-2", config.bg, config.border)}>
              <div className="flex items-center gap-2">
                <ShieldAlert className={cn("h-4 w-4", config.color)} />
                <span className={cn("text-xs font-semibold uppercase tracking-wide", config.color)}>
                  {config.label}
                </span>
              </div>
              <p className="text-2xl font-bold font-mono">{summary.counts[level]}</p>
              <p className="text-xs text-muted-foreground">
                Receita em risco: {formatCurrency(summary.revenue[level])}
              </p>
            </div>
          );
        })}
      </div>

      {/* Priority List */}
      <div className="rounded-xl border bg-card/60">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <AlertTriangle className="h-4 w-4 text-status-today" />
          <h3 className="text-sm font-semibold">Prioridade de Cobrança</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            {riskedClients.filter((r) => r.level === "critical" || r.level === "high").length} clientes prioritários
          </span>
        </div>

        <div className="max-h-[500px] overflow-y-auto divide-y">
          {riskedClients.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <ShieldAlert className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhum cliente cadastrado</p>
            </div>
          ) : (
            riskedClients.slice(0, 30).map(({ client, score, level, factors }) => {
              const config = LEVEL_CONFIG[level];
              return (
                <button
                  key={client.id}
                  onClick={() => onClientClick?.(client)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  {/* Score circle */}
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    config.bg, config.color, config.border, "border"
                  )}>
                    {score}
                  </div>

                  {/* Client info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{client.name}</p>
                      <span className={cn("text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full", config.bg, config.color)}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(client.valor || 0)}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        {getStatusFromDate(client.expiration_date).label}
                      </span>
                    </div>
                    {factors.length > 0 && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">
                        {factors.join(" · ")}
                      </p>
                    )}
                  </div>

                  {/* Score bar */}
                  <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 w-24">
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", config.bar)} style={{ width: `${score}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{score}/100</span>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
