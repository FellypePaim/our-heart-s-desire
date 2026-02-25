import { useState, useMemo, useCallback } from "react";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { getStatusFromDate } from "@/lib/status";
import { Client } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Download, Users, UserPlus, UserMinus, DollarSign,
  TrendingUp, TrendingDown, BarChart3, Eye, EyeOff, Percent
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isAfter, isBefore, isEqual } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, Area, AreaChart
} from "recharts";

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 1; i <= 12; i++) {
    const d = subMonths(now, i);
    options.push({
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy", { locale: ptBR }),
    });
  }
  return options;
}

interface MonthlyMetrics {
  month: string;
  monthLabel: string;
  totalClients: number;
  activeClients: number;
  newClients: number;
  lostClients: number;
  churnRate: number;
  retentionRate: number;
  totalRevenue: number;
  activeRevenue: number;
  atRiskRevenue: number;
  avgTicket: number;
  byPlan: { plan: string; count: number; revenue: number }[];
  byServer: { server: string; count: number; revenue: number }[];
  byPayment: { method: string; count: number }[];
  topClients: { name: string; valor: number; plan: string }[];
}

function computeMetrics(clients: Client[], month: string): MonthlyMetrics {
  const [year, mon] = month.split("-").map(Number);
  const start = startOfMonth(new Date(year, mon - 1));
  const end = endOfMonth(new Date(year, mon - 1));

  // Clients that existed during that month (created before end of month)
  const relevantClients = clients.filter((c) => {
    const created = new Date(c.created_at);
    return isBefore(created, end) || isEqual(created, end);
  });

  // New clients (created during the month)
  const newClients = clients.filter((c) => {
    const created = new Date(c.created_at);
    return (isAfter(created, start) || isEqual(created, start)) &&
           (isBefore(created, end) || isEqual(created, end));
  });

  // Lost/churned: expiration_date fell within the month and status was expired
  const lostClients = relevantClients.filter((c) => {
    const [ey, em, ed] = c.expiration_date.split("-").map(Number);
    const expDate = new Date(ey, em - 1, ed);
    return (isBefore(expDate, end) || isEqual(expDate, end)) &&
           (isAfter(expDate, start) || isEqual(expDate, start));
  });

  // Active at end of month: expiration >= end of month
  const activeAtEnd = relevantClients.filter((c) => {
    const [ey, em, ed] = c.expiration_date.split("-").map(Number);
    const expDate = new Date(ey, em - 1, ed);
    return isAfter(expDate, end) || isEqual(expDate, end);
  });

  const atRiskClients = relevantClients.filter((c) => {
    const status = getStatusFromDate(c.expiration_date);
    return ["post1", "post2", "expired"].includes(status.key);
  });

  const totalRevenue = relevantClients.reduce((s, c) => s + (c.valor || 0), 0);
  const activeRevenue = activeAtEnd.reduce((s, c) => s + (c.valor || 0), 0);
  const atRiskRevenue = atRiskClients.reduce((s, c) => s + (c.valor || 0), 0);

  const startCount = relevantClients.length - newClients.length;
  const churnRate = startCount > 0 ? (lostClients.length / startCount) * 100 : 0;
  const retentionRate = 100 - churnRate;

  // Breakdowns
  const planMap: Record<string, { count: number; revenue: number }> = {};
  const serverMap: Record<string, { count: number; revenue: number }> = {};
  const payMap: Record<string, number> = {};

  relevantClients.forEach((c) => {
    const plan = c.plan || "Sem plano";
    if (!planMap[plan]) planMap[plan] = { count: 0, revenue: 0 };
    planMap[plan].count++;
    planMap[plan].revenue += c.valor || 0;

    const srv = c.servidor || "Sem servidor";
    if (!serverMap[srv]) serverMap[srv] = { count: 0, revenue: 0 };
    serverMap[srv].count++;
    serverMap[srv].revenue += c.valor || 0;

    const pay = c.forma_pagamento || "Não informado";
    payMap[pay] = (payMap[pay] || 0) + 1;
  });

  const topClients = [...relevantClients]
    .sort((a, b) => (b.valor || 0) - (a.valor || 0))
    .slice(0, 10)
    .map((c) => ({ name: c.name, valor: c.valor || 0, plan: c.plan || "-" }));

  return {
    month,
    monthLabel: format(start, "MMMM yyyy", { locale: ptBR }),
    totalClients: relevantClients.length,
    activeClients: activeAtEnd.length,
    newClients: newClients.length,
    lostClients: lostClients.length,
    churnRate: Math.round(churnRate * 10) / 10,
    retentionRate: Math.round(retentionRate * 10) / 10,
    totalRevenue,
    activeRevenue,
    atRiskRevenue,
    avgTicket: relevantClients.length > 0 ? totalRevenue / relevantClients.length : 0,
    byPlan: Object.entries(planMap).map(([plan, d]) => ({ plan, ...d })).sort((a, b) => b.count - a.count),
    byServer: Object.entries(serverMap).map(([server, d]) => ({ server, ...d })).sort((a, b) => b.count - a.count),
    byPayment: Object.entries(payMap).map(([method, count]) => ({ method, count })).sort((a, b) => b.count - a.count),
    topClients,
  };
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function Reports() {
  const { data: clients } = useClients({ ownOnly: true });
  const { user } = useAuth();
  const { hidden, toggle, mask } = usePrivacyMode();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);

  const metrics = useMemo(
    () => computeMetrics(clients || [], selectedMonth),
    [clients, selectedMonth]
  );

  // Compute last 6 months of metrics for trend charts
  const trendData = useMemo(() => {
    if (!clients) return [];
    const data: {
      month: string;
      label: string;
      total: number;
      ativos: number;
      novos: number;
      perdidos: number;
      receita: number;
      receitaAtiva: number;
      churn: number;
      ticket: number;
    }[] = [];
    const now = new Date();
    for (let i = 6; i >= 1; i--) {
      const d = subMonths(now, i);
      const key = format(d, "yyyy-MM");
      const m = computeMetrics(clients, key);
      data.push({
        month: key,
        label: format(d, "MMM yy", { locale: ptBR }),
        total: m.totalClients,
        ativos: m.activeClients,
        novos: m.newClients,
        perdidos: m.lostClients,
        receita: m.totalRevenue,
        receitaAtiva: m.activeRevenue,
        churn: m.churnRate,
        ticket: m.avgTicket,
      });
    }
    return data;
  }, [clients]);

  const fmtVal = (v: number) => (hidden ? mask(String(v), "value") : formatBRL(v));

  const exportPDF = useCallback(() => {
    const doc = new jsPDF();
    const m = metrics;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório Mensal", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(m.monthLabel.charAt(0).toUpperCase() + m.monthLabel.slice(1), pageWidth / 2, 28, { align: "center" });

    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageWidth / 2, 34, { align: "center" });
    doc.setTextColor(0);

    // KPI section
    let y = 44;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo Geral", 14, y);
    y += 8;

    const kpis = [
      ["Total de Clientes", String(m.totalClients)],
      ["Clientes Ativos", String(m.activeClients)],
      ["Novos Clientes", String(m.newClients)],
      ["Clientes Perdidos", String(m.lostClients)],
      ["Taxa de Churn", `${m.churnRate}%`],
      ["Taxa de Retenção", `${m.retentionRate}%`],
      ["Receita Total", formatBRL(m.totalRevenue)],
      ["Receita Ativa", formatBRL(m.activeRevenue)],
      ["Receita em Risco", formatBRL(m.atRiskRevenue)],
      ["Ticket Médio", formatBRL(m.avgTicket)],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Métrica", "Valor"]],
      body: kpis,
      theme: "grid",
      headStyles: { fillColor: [30, 30, 30], fontSize: 10 },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // By Plan
    if (m.byPlan.length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Por Plano", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Plano", "Clientes", "Receita"]],
        body: m.byPlan.map((p) => [p.plan, String(p.count), formatBRL(p.revenue)]),
        theme: "striped",
        headStyles: { fillColor: [30, 30, 30], fontSize: 10 },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }

    // By Server
    if (m.byServer.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Por Servidor", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Servidor", "Clientes", "Receita"]],
        body: m.byServer.map((s) => [s.server, String(s.count), formatBRL(s.revenue)]),
        theme: "striped",
        headStyles: { fillColor: [30, 30, 30], fontSize: 10 },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }

    // Top Clients
    if (m.topClients.length > 0) {
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Top 10 Clientes por Valor", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["#", "Nome", "Plano", "Valor"]],
        body: m.topClients.map((c, i) => [String(i + 1), c.name, c.plan, formatBRL(c.valor)]),
        theme: "striped",
        headStyles: { fillColor: [30, 30, 30], fontSize: 10 },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
    }

    doc.save(`relatorio-${m.month}.pdf`);
  }, [metrics]);

  const kpiCards = [
    { label: "Total Clientes", value: String(metrics.totalClients), icon: Users, color: "text-foreground" },
    { label: "Novos", value: `+${metrics.newClients}`, icon: UserPlus, color: "text-green-600 dark:text-green-400" },
    { label: "Perdidos", value: `-${metrics.lostClients}`, icon: UserMinus, color: "text-red-600 dark:text-red-400" },
    { label: "Ativos", value: String(metrics.activeClients), icon: TrendingUp, color: "text-blue-600 dark:text-blue-400" },
    { label: "Churn", value: `${metrics.churnRate}%`, icon: Percent, color: "text-orange-600 dark:text-orange-400" },
    { label: "Retenção", value: `${metrics.retentionRate}%`, icon: BarChart3, color: "text-green-600 dark:text-green-400" },
    { label: "Receita Total", value: fmtVal(metrics.totalRevenue), icon: DollarSign, color: "text-foreground" },
    { label: "Receita Ativa", value: fmtVal(metrics.activeRevenue), icon: TrendingUp, color: "text-green-600 dark:text-green-400" },
    { label: "Em Risco", value: fmtVal(metrics.atRiskRevenue), icon: TrendingDown, color: "text-red-600 dark:text-red-400" },
    { label: "Ticket Médio", value: fmtVal(metrics.avgTicket), icon: DollarSign, color: "text-blue-600 dark:text-blue-400" },
  ];

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      <header className="border-b px-4 md:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              Relatório Mensal
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Resumo completo do mês anterior
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label.charAt(0).toUpperCase() + o.label.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={toggle} className="h-9 w-9">
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button onClick={exportPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card/60 p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold font-mono tracking-tight">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Trend Charts */}
        {trendData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Clients Evolution */}
            <div className="rounded-xl border bg-card/60 p-5">
              <h3 className="text-sm font-semibold mb-4">Evolução de Clientes (6 meses)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="total" name="Total" stroke="hsl(220, 70%, 50%)" fill="hsl(220, 70%, 50%)" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="ativos" name="Ativos" stroke="hsl(142, 60%, 40%)" fill="hsl(142, 60%, 40%)" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue Evolution */}
            <div className="rounded-xl border bg-card/60 p-5">
              <h3 className="text-sm font-semibold mb-4">Evolução de Receita (6 meses)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => [formatBRL(v)]} />
                  <Legend />
                  <Area type="monotone" dataKey="receita" name="Receita Total" stroke="hsl(220, 70%, 50%)" fill="hsl(220, 70%, 50%)" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="receitaAtiva" name="Receita Ativa" stroke="hsl(142, 60%, 40%)" fill="hsl(142, 60%, 40%)" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* New vs Lost */}
            <div className="rounded-xl border bg-card/60 p-5">
              <h3 className="text-sm font-semibold mb-4">Novos vs Perdidos (6 meses)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="novos" name="Novos" fill="hsl(142, 60%, 40%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="perdidos" name="Perdidos" fill="hsl(0, 70%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Churn & Ticket */}
            <div className="rounded-xl border bg-card/60 p-5">
              <h3 className="text-sm font-semibold mb-4">Churn % & Ticket Médio (6 meses)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number, name: string) => [name === "Churn %" ? `${v}%` : formatBRL(v), name]} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="churn" name="Churn %" stroke="hsl(15, 95%, 50%)" strokeWidth={2} dot={{ r: 4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="ticket" name="Ticket Médio" stroke="hsl(220, 70%, 50%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Plan */}
          <div className="rounded-xl border bg-card/60 overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Distribuição por Plano</h3>
            </div>
            <div className="divide-y">
              {metrics.byPlan.map((p) => (
                <div key={p.plan} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm">{p.plan}</span>
                  <div className="flex items-center gap-4 text-sm font-mono">
                    <span className="text-muted-foreground">{p.count} clientes</span>
                    <span className="font-medium">{fmtVal(p.revenue)}</span>
                  </div>
                </div>
              ))}
              {metrics.byPlan.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
              )}
            </div>
          </div>

          {/* By Server */}
          <div className="rounded-xl border bg-card/60 overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Distribuição por Servidor</h3>
            </div>
            <div className="divide-y">
              {metrics.byServer.map((s) => (
                <div key={s.server} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm">{s.server}</span>
                  <div className="flex items-center gap-4 text-sm font-mono">
                    <span className="text-muted-foreground">{s.count} clientes</span>
                    <span className="font-medium">{fmtVal(s.revenue)}</span>
                  </div>
                </div>
              ))}
              {metrics.byServer.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
              )}
            </div>
          </div>

          {/* By Payment */}
          <div className="rounded-xl border bg-card/60 overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Formas de Pagamento</h3>
            </div>
            <div className="divide-y">
              {metrics.byPayment.map((p) => (
                <div key={p.method} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm">{p.method}</span>
                  <span className="text-sm font-mono text-muted-foreground">{p.count} clientes</span>
                </div>
              ))}
              {metrics.byPayment.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
              )}
            </div>
          </div>

          {/* Top 10 Clients */}
          <div className="rounded-xl border bg-card/60 overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Top 10 Clientes por Valor</h3>
            </div>
            <div className="divide-y">
              {metrics.topClients.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <span className="text-sm flex-1 truncate">{hidden ? mask(c.name, "text") : c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.plan}</span>
                  <span className="text-sm font-mono font-medium">{fmtVal(c.valor)}</span>
                </div>
              ))}
              {metrics.topClients.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
