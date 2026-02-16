import { useState, useMemo } from "react";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate, StatusKey } from "@/lib/status";
import {
  Users, DollarSign, TrendingUp, TrendingDown, CalendarCheck,
  AlertTriangle, CheckCircle, XCircle, Clock, BarChart3
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subDays, subMonths, isAfter, startOfDay } from "date-fns";

interface ClientMetricsProps {
  clients: Client[];
  isLoading: boolean;
  mask?: (value: string | null | undefined, type: "phone" | "value" | "email" | "text") => string;
}

const STATUS_COLORS: Record<StatusKey, string> = {
  active: "hsl(142, 60%, 40%)",
  pre3: "hsl(45, 80%, 48%)",
  pre2: "hsl(38, 85%, 50%)",
  pre1: "hsl(28, 90%, 50%)",
  today: "hsl(15, 95%, 50%)",
  post1: "hsl(5, 85%, 50%)",
  post2: "hsl(0, 80%, 45%)",
  expired: "hsl(0, 70%, 35%)",
};

const STATUS_LABELS: Record<StatusKey, string> = {
  active: "Ativos",
  pre3: "Vence 3d",
  pre2: "Vence 2d",
  pre1: "Vence amanhã",
  today: "Vence hoje",
  post1: "Venceu ontem",
  post2: "Venceu 2d",
  expired: "Vencido",
};

type PeriodFilter = "all" | "7d" | "30d" | "90d" | "this_month" | "last_month";

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "all", label: "Todos os períodos" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês anterior" },
];

function getFilteredClients(clients: Client[], period: PeriodFilter): Client[] {
  if (period === "all") return clients;

  const now = new Date();
  let startDate: Date;

  switch (period) {
    case "7d":
      startDate = subDays(now, 7);
      break;
    case "30d":
      startDate = subDays(now, 30);
      break;
    case "90d":
      startDate = subDays(now, 90);
      break;
    case "this_month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth(), 1);
      return clients.filter((c) => {
        const created = new Date(c.created_at);
        return isAfter(created, startDate) && !isAfter(created, endDate);
      });
    }
    default:
      return clients;
  }

  return clients.filter((c) => isAfter(new Date(c.created_at), startOfDay(startDate)));
}

export function ClientMetrics({ clients, isLoading, mask }: ClientMetricsProps) {
  const [period, setPeriod] = useState<PeriodFilter>("all");

  const filteredClients = useMemo(() => getFilteredClients(clients, period), [clients, period]);

  const metrics = useMemo(() => {
    const list = filteredClients;
    if (!list || list.length === 0) {
      return {
        total: 0, active: 0, overdue: 0, urgent: 0,
        totalRevenue: 0, avgTicket: 0, forecastRevenue: 0,
        overdueRevenue: 0, todayRevenue: 0, todayCount: 0,
        statusBreakdown: [] as { name: string; value: number; color: string }[],
        serverBreakdown: [] as { name: string; clientes: number; receita: number }[],
        paymentBreakdown: [] as { name: string; value: number; color: string }[],
      };
    }

    const groups: Record<StatusKey, Client[]> = {
      active: [], pre3: [], pre2: [], pre1: [],
      today: [], post1: [], post2: [], expired: [],
    };

    list.forEach((c) => {
      const status = getStatusFromDate(c.expiration_date);
      groups[status.key].push(c);
    });

    const activeClients = [...groups.active, ...groups.pre3, ...groups.pre2, ...groups.pre1];
    const overdueClients = [...groups.post1, ...groups.post2, ...groups.expired];
    const urgentClients = [...groups.today, ...groups.pre1];

    const totalRevenue = list.reduce((sum, c) => sum + (c.valor || 0), 0);
    const activeRevenue = activeClients.reduce((sum, c) => sum + (c.valor || 0), 0);
    const overdueRevenue = overdueClients.reduce((sum, c) => sum + (c.valor || 0), 0);
    const todayRevenue = groups.today.reduce((sum, c) => sum + (c.valor || 0), 0);
    const avgTicket = list.length > 0 ? totalRevenue / list.length : 0;

    const statusBreakdown = (Object.keys(groups) as StatusKey[])
      .filter((key) => groups[key].length > 0)
      .map((key) => ({
        name: STATUS_LABELS[key],
        value: groups[key].length,
        color: STATUS_COLORS[key],
      }));

    const serverMap: Record<string, { clientes: number; receita: number }> = {};
    list.forEach((c) => {
      const srv = c.servidor || "Sem servidor";
      if (!serverMap[srv]) serverMap[srv] = { clientes: 0, receita: 0 };
      serverMap[srv].clientes++;
      serverMap[srv].receita += c.valor || 0;
    });
    const serverBreakdown = Object.entries(serverMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.clientes - a.clientes)
      .slice(0, 8);

    const paymentMap: Record<string, number> = {};
    list.forEach((c) => {
      const pay = c.forma_pagamento || "Não informado";
      paymentMap[pay] = (paymentMap[pay] || 0) + 1;
    });
    const payColors = ["hsl(220, 70%, 50%)", "hsl(142, 60%, 40%)", "hsl(45, 80%, 48%)", "hsl(280, 60%, 50%)", "hsl(15, 95%, 50%)", "hsl(190, 70%, 45%)"];
    const paymentBreakdown = Object.entries(paymentMap)
      .map(([name, value], i) => ({ name, value, color: payColors[i % payColors.length] }))
      .sort((a, b) => b.value - a.value);

    return {
      total: list.length,
      active: activeClients.length,
      overdue: overdueClients.length,
      urgent: urgentClients.length,
      totalRevenue,
      avgTicket,
      forecastRevenue: activeRevenue,
      overdueRevenue,
      todayRevenue,
      todayCount: groups.today.length,
      statusBreakdown,
      serverBreakdown,
      paymentBreakdown,
    };
  }, [filteredClients]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando métricas...
      </div>
    );
  }

  const kpiCards = [
    { label: "Total de Clientes", value: metrics.total, icon: Users, color: "text-foreground", format: "number" },
    { label: "Ativos", value: metrics.active, icon: CheckCircle, color: "text-status-active", format: "number" },
    { label: "Urgentes", value: metrics.urgent, icon: AlertTriangle, color: "text-status-today", format: "number" },
    { label: "Atrasados", value: metrics.overdue, icon: XCircle, color: "text-status-expired", format: "number" },
    { label: "Receita Total", value: metrics.totalRevenue, icon: DollarSign, color: "text-emerald-600", format: "currency" },
    { label: "Ticket Médio", value: metrics.avgTicket, icon: BarChart3, color: "text-blue-600", format: "currency" },
    { label: "Previsão (Ativos)", value: metrics.forecastRevenue, icon: TrendingUp, color: "text-status-active", format: "currency" },
    { label: "Em Risco (Atrasados)", value: metrics.overdueRevenue, icon: TrendingDown, color: "text-status-expired", format: "currency" },
    { label: "Vence Hoje (R$)", value: metrics.todayRevenue, icon: Clock, color: "text-status-today", format: "currency" },
    { label: "Vencem Hoje", value: metrics.todayCount, icon: CalendarCheck, color: "text-status-today", format: "number" },
  ];

  const formatValue = (value: number, format: string) => {
    if (format === "currency") {
      if (mask) return mask(String(value), "value");
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    }
    return value.toLocaleString("pt-BR");
  };

  return (
    <div className="space-y-6 p-4 md:p-6 overflow-auto">
      {/* Period Filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Métricas de Clientes</h3>
        <Select value={period} onValueChange={(v: PeriodFilter) => setPeriod(v)}>
          <SelectTrigger className="w-[200px]">
            <CalendarCheck className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <span className="text-xs text-muted-foreground truncate">{kpi.label}</span>
            </div>
            <p className="text-lg md:text-xl font-bold font-mono">
              {formatValue(kpi.value, kpi.format)}
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Distribuição por Status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={metrics.statusBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {metrics.statusBreakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [v, "Clientes"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Server Distribution Bar */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Clientes por Servidor</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={metrics.serverBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 88%)" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: number, name: string) => [
                  name === "receita"
                    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
                    : v,
                  name === "receita" ? "Receita" : "Clientes",
                ]}
              />
              <Legend />
              <Bar dataKey="clientes" fill="hsl(220, 70%, 50%)" name="Clientes" radius={[0, 4, 4, 0]} />
              <Bar dataKey="receita" fill="hsl(142, 60%, 40%)" name="Receita (R$)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Method Pie */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Formas de Pagamento</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={metrics.paymentBreakdown}
                cx="50%"
                cy="50%"
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {metrics.paymentBreakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [v, "Clientes"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Summary Card */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="text-sm font-semibold">Resumo Financeiro</h3>
          <div className="space-y-3">
            {[
              { label: "Receita Total (carteira)", value: metrics.totalRevenue, color: "text-foreground" },
              { label: "Previsão Mensal (ativos)", value: metrics.forecastRevenue, color: "text-status-active" },
              { label: "Em risco (atrasados)", value: metrics.overdueRevenue, color: "text-status-expired" },
              { label: "Ticket Médio", value: metrics.avgTicket, color: "text-blue-600" },
              { label: "Vencendo Hoje (R$)", value: metrics.todayRevenue, color: "text-status-today" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className={`font-mono font-semibold ${item.color}`}>
                  {mask ? mask(String(item.value), "value") : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
