import { useMemo } from "react";
import { useGlobalStats, useAllClients } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatusFromDate, getAllStatuses } from "@/lib/status";
import {
  Globe, Building2, Users, UserCheck, AlertTriangle, TrendingDown,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

const AdminDashboard = () => {
  const { isSuperAdmin, loading } = useAuth();
  const { data: stats, isLoading } = useGlobalStats();
  const { data: allClients } = useAllClients();

  // Status distribution chart data
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

  // Server distribution chart data
  const serverDistribution = useMemo(() => {
    if (!allClients) return [];
    const counts: Record<string, number> = {};
    allClients.forEach((c) => {
      const srv = c.servidor || "Sem servidor";
      counts[srv] = (counts[srv] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [allClients]);

  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const statCards = [
    { label: "Painéis Ativos", value: stats?.activeTenants ?? 0, total: stats?.totalTenants, icon: Building2, color: "text-status-active" },
    { label: "Usuários", value: stats?.totalUsers ?? 0, icon: Users, color: "text-foreground" },
    { label: "Revendedores", value: stats?.resellers ?? 0, icon: UserCheck, color: "text-status-pre3" },
    { label: "Clientes", value: stats?.totalClients ?? 0, icon: Users, color: "text-status-pre1" },
    { label: "Inadimplentes", value: stats?.overdueClients ?? 0, icon: AlertTriangle, color: "text-status-expired" },
    { label: "Taxa Inadimplência", value: `${stats?.overdueRate ?? 0}%`, icon: TrendingDown, color: "text-status-post1" },
  ];


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

  const BAR_COLORS = ["hsl(220, 25%, 30%)", "hsl(220, 25%, 45%)", "hsl(220, 25%, 60%)", "hsl(220, 25%, 70%)"];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="h-5 w-5 md:h-6 md:w-6" />
          Dashboard Global
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visão consolidada de todos os painéis
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold font-mono">
                {isLoading ? "..." : s.value}
              </p>
              {s.total !== undefined && (
                <p className="text-xs text-muted-foreground">de {s.total} total</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLORS[entry.key] || "#888"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Server Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes por Servidor</CardTitle>
          </CardHeader>
          <CardContent>
            {serverDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={serverDistribution} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Clientes" radius={[0, 4, 4, 0]}>
                    {serverDistribution.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
