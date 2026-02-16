import { useMemo } from "react";
import { useGlobalStats, useAllClients, useAllUserRoles } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatusFromDate, getAllStatuses } from "@/lib/status";
import {
  Globe, Users, UserCheck, AlertTriangle, TrendingDown,
  DollarSign, BarChart3, Crown, Store, TrendingUp, Clock
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function useAllResellers() {
  const { isSuperAdmin } = useAuth();
  return useQuery({
    queryKey: ["all_resellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resellers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });
}

const STATUS_COLORS: Record<string, string> = {
  active: "hsl(142, 60%, 40%)",
  pre3: "hsl(45, 80%, 48%)",
  pre2: "hsl(38, 85%, 50%)",
  pre1: "hsl(28, 90%, 50%)",
  today: "hsl(15, 95%, 50%)",
  post1: "hsl(5, 85%, 50%)",
  post2: "hsl(0, 80%, 45%)",
  expired: "hsl(0, 70%, 35%)",
};

const PIE_COLORS = ["hsl(220, 70%, 50%)", "hsl(142, 60%, 40%)", "hsl(45, 80%, 48%)", "hsl(280, 60%, 50%)", "hsl(15, 95%, 50%)", "hsl(190, 70%, 45%)", "hsl(0, 70%, 45%)", "hsl(320, 60%, 50%)"];

const AdminDashboard = () => {
  const { isSuperAdmin, loading } = useAuth();
  const { data: stats, isLoading } = useGlobalStats();
  const { data: allClients } = useAllClients();
  const { data: allRoles } = useAllUserRoles();
  const { data: allResellers } = useAllResellers();

  const roleCounts = useMemo(() => {
    if (!allRoles) return { masters: 0, resellers: 0, users: 0 };
    const masters = allRoles.filter((r) => r.role === "panel_admin" && r.is_active).length;
    const resellers = allRoles.filter((r) => r.role === "reseller" && r.is_active).length;
    const users = allRoles.filter((r) => r.role === "user" && r.is_active).length;
    return { masters, resellers, users };
  }, [allRoles]);

  const financials = useMemo(() => {
    if (!allClients) return { totalRevenue: 0, avgTicket: 0, activeRevenue: 0, overdueRevenue: 0, todayRevenue: 0 };
    const today = new Date();
    const totalRevenue = allClients.reduce((s, c) => s + (c.valor || 0), 0);
    const avgTicket = allClients.length > 0 ? totalRevenue / allClients.length : 0;
    const activeRevenue = allClients.filter((c) => new Date(c.expiration_date) >= today).reduce((s, c) => s + (c.valor || 0), 0);
    const overdueRevenue = allClients.filter((c) => new Date(c.expiration_date) < today).reduce((s, c) => s + (c.valor || 0), 0);
    const todayStr = today.toISOString().split("T")[0];
    const todayRevenue = allClients.filter((c) => c.expiration_date === todayStr).reduce((s, c) => s + (c.valor || 0), 0);
    return { totalRevenue, avgTicket, activeRevenue, overdueRevenue, todayRevenue };
  }, [allClients]);

  const resellerStats = useMemo(() => {
    if (!allResellers) return { total: 0, active: 0, suspended: 0, totalResClients: 0 };
    const active = allResellers.filter((r: any) => r.status === "active").length;
    const suspended = allResellers.filter((r: any) => r.status === "suspended").length;
    const resIds = allResellers.map((r: any) => r.id);
    const totalResClients = allClients?.filter((c) => c.reseller_id && resIds.includes(c.reseller_id)).length || 0;
    return { total: allResellers.length, active, suspended, totalResClients };
  }, [allResellers, allClients]);

  const statusDistribution = useMemo(() => {
    if (!allClients) return [];
    const counts: Record<string, number> = {};
    allClients.forEach((c) => {
      const status = getStatusFromDate(c.expiration_date);
      counts[status.key] = (counts[status.key] || 0) + 1;
    });
    const allStatuses = getAllStatuses();
    return allStatuses
      .map((s) => ({ name: s.label, value: counts[s.key] || 0, key: s.key }))
      .filter((d) => d.value > 0);
  }, [allClients]);

  const serverDistribution = useMemo(() => {
    if (!allClients) return [];
    const counts: Record<string, { clientes: number; receita: number }> = {};
    allClients.forEach((c) => {
      const srv = c.servidor || "Sem servidor";
      if (!counts[srv]) counts[srv] = { clientes: 0, receita: 0 };
      counts[srv].clientes++;
      counts[srv].receita += c.valor || 0;
    });
    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.clientes - a.clientes)
      .slice(0, 10);
  }, [allClients]);

  const paymentDistribution = useMemo(() => {
    if (!allClients) return [];
    const counts: Record<string, number> = {};
    allClients.forEach((c) => {
      const pay = c.forma_pagamento || "Não informado";
      counts[pay] = (counts[pay] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [allClients]);

  const roleDistribution = useMemo(() => {
    return [
      { name: "Masters", value: roleCounts.masters, color: "hsl(280, 60%, 50%)" },
      { name: "Revendedores", value: roleCounts.resellers, color: "hsl(220, 70%, 50%)" },
      { name: "Usuários", value: roleCounts.users, color: "hsl(142, 60%, 40%)" },
    ].filter((d) => d.value > 0);
  }, [roleCounts]);

  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const statCards = [
    { label: "Masters", value: roleCounts.masters, icon: Crown, color: "text-purple-600" },
    { label: "Revendedores", value: resellerStats.total, sub: `${resellerStats.active} ativos`, icon: Store, color: "text-blue-600" },
    { label: "Clientes Finais", value: stats?.totalClients ?? 0, icon: Users, color: "text-foreground" },
    { label: "Inadimplentes", value: stats?.overdueClients ?? 0, icon: AlertTriangle, color: "text-status-expired" },
    { label: "Taxa Inadimplência", value: `${stats?.overdueRate ?? 0}%`, icon: TrendingDown, color: "text-status-post1" },
    { label: "Receita Global", value: fmt(financials.totalRevenue), icon: DollarSign, color: "text-emerald-600" },
    { label: "Ticket Médio", value: fmt(financials.avgTicket), icon: BarChart3, color: "text-blue-600" },
    { label: "Previsão (Ativos)", value: fmt(financials.activeRevenue), icon: TrendingUp, color: "text-status-active" },
    { label: "Em Risco", value: fmt(financials.overdueRevenue), icon: TrendingDown, color: "text-status-expired" },
    { label: "Vence Hoje (R$)", value: fmt(financials.todayRevenue), icon: Clock, color: "text-status-today" },
    { label: "Clientes via Revenda", value: resellerStats.totalResClients, icon: UserCheck, color: "text-status-pre3" },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="h-5 w-5 md:h-6 md:w-6" />
          Dashboard Global
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visão consolidada de todos os masters, revendedores e clientes
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground truncate">{s.label}</span>
              </div>
              <p className="text-xl font-bold font-mono">
                {isLoading ? "..." : s.value}
              </p>
              {(s as any).sub && (
                <p className="text-xs text-muted-foreground">{(s as any).sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Status</CardTitle></CardHeader>
          <CardContent>
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} label={({ name, value }) => `${name}: ${value}`}>
                    {statusDistribution.map((entry) => (<Cell key={entry.key} fill={STATUS_COLORS[entry.key] || "#888"} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (<p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Cargo</CardTitle></CardHeader>
          <CardContent>
            {roleDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={roleDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                    {roleDistribution.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, "Usuários"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (<p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Clientes por Servidor</CardTitle></CardHeader>
          <CardContent>
            {serverDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={serverDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 88%)" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number, name: string) => [name === "receita" ? fmt(v) : v, name === "receita" ? "Receita" : "Clientes"]} />
                  <Legend />
                  <Bar dataKey="clientes" fill="hsl(220, 70%, 50%)" name="Clientes" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="receita" fill="hsl(142, 60%, 40%)" name="Receita (R$)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (<p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Formas de Pagamento</CardTitle></CardHeader>
          <CardContent>
            {paymentDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={paymentDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} paddingAngle={2} label={({ name, value }) => `${name}: ${value}`}>
                    {paymentDistribution.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, "Clientes"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (<p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>)}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Resumo Financeiro Global</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: "Receita Total (carteira)", value: financials.totalRevenue, color: "text-foreground" },
                { label: "Previsão Mensal (ativos)", value: financials.activeRevenue, color: "text-status-active" },
                { label: "Em risco (atrasados)", value: financials.overdueRevenue, color: "text-status-expired" },
                { label: "Ticket Médio", value: financials.avgTicket, color: "text-blue-600" },
                { label: "Vencendo Hoje", value: financials.todayRevenue, color: "text-status-today" },
                { label: "Total Clientes Finais", value: stats?.totalClients ?? 0, color: "text-foreground", isNumber: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3 px-4 rounded-lg border">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className={`font-mono font-semibold ${item.color}`}>
                    {(item as any).isNumber ? item.value : fmt(item.value as number)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
