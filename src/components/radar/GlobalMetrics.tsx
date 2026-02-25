import { useMemo } from "react";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate, StatusKey } from "@/lib/status";
import {
  Users, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, XCircle, Globe, Store, ShieldCheck
} from "lucide-react";

interface GlobalMetricsProps {
  allClients: Client[];
  isLoading: boolean;
  mask?: (value: string | null | undefined, type: "phone" | "value" | "email" | "text") => string;
}

export function GlobalMetrics({ allClients, isLoading, mask }: GlobalMetricsProps) {
  const metrics = useMemo(() => {
    if (!allClients || allClients.length === 0) {
      return {
        total: 0, active: 0, overdue: 0, urgent: 0,
        totalRevenue: 0, avgTicket: 0, forecastRevenue: 0,
        overdueRevenue: 0, masters: 0, resellers: 0,
      };
    }

    const groups: Record<StatusKey, Client[]> = {
      active: [], pre3: [], pre2: [], pre1: [],
      today: [], post1: [], post2: [], expired: [],
    };

    allClients.forEach((c) => {
      const status = getStatusFromDate(c.expiration_date);
      groups[status.key].push(c);
    });

    const activeClients = [...groups.active, ...groups.pre3, ...groups.pre2, ...groups.pre1];
    const overdueClients = [...groups.post1, ...groups.post2, ...groups.expired];
    const urgentClients = [...groups.today, ...groups.pre1];

    const totalRevenue = allClients.reduce((sum, c) => sum + (c.valor || 0), 0);
    const activeRevenue = activeClients.reduce((sum, c) => sum + (c.valor || 0), 0);
    const overdueRevenue = overdueClients.reduce((sum, c) => sum + (c.valor || 0), 0);
    const avgTicket = allClients.length > 0 ? totalRevenue / allClients.length : 0;

    // Count unique masters (user_ids) and resellers (reseller_ids)
    const uniqueMasters = new Set(allClients.map((c) => c.user_id)).size;
    const uniqueResellers = new Set(allClients.filter((c) => c.reseller_id).map((c) => c.reseller_id)).size;

    return {
      total: allClients.length,
      active: activeClients.length,
      overdue: overdueClients.length,
      urgent: urgentClients.length,
      totalRevenue,
      avgTicket,
      forecastRevenue: activeRevenue,
      overdueRevenue,
      masters: uniqueMasters,
      resellers: uniqueResellers,
    };
  }, [allClients]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        Carregando métricas globais...
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    if (mask) return mask(String(value), "value");
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const kpiCards = [
    { label: "Total de Clientes", value: metrics.total, icon: Users, color: "text-foreground", format: "number" as const },
    { label: "Ativos", value: metrics.active, icon: CheckCircle, color: "text-status-active", format: "number" as const },
    { label: "Urgentes", value: metrics.urgent, icon: AlertTriangle, color: "text-status-today", format: "number" as const },
    { label: "Atrasados", value: metrics.overdue, icon: XCircle, color: "text-status-expired", format: "number" as const },
    { label: "Masters Ativos", value: metrics.masters, icon: ShieldCheck, color: "text-blue-600", format: "number" as const },
    { label: "Revendas Ativas", value: metrics.resellers, icon: Store, color: "text-purple-600", format: "number" as const },
    { label: "Receita Total", value: metrics.totalRevenue, icon: DollarSign, color: "text-emerald-600", format: "currency" as const },
    { label: "Previsão (Ativos)", value: metrics.forecastRevenue, icon: TrendingUp, color: "text-status-active", format: "currency" as const },
    { label: "Em Risco", value: metrics.overdueRevenue, icon: TrendingDown, color: "text-status-expired", format: "currency" as const },
    { label: "Ticket Médio", value: metrics.avgTicket, icon: DollarSign, color: "text-blue-600", format: "currency" as const },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-muted-foreground">Métricas Globais do Sistema</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border bg-card/60 p-4 space-y-1.5 glass card-hover flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <span className="text-xs font-medium text-muted-foreground truncate">{kpi.label}</span>
            </div>
            <p className="text-lg md:text-xl font-bold font-mono tracking-tight mt-auto">
              {kpi.format === "currency" ? formatCurrency(kpi.value) : kpi.value.toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
