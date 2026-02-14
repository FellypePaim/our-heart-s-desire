import { useGlobalStats, useTenants, useAllClients } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { getStatusFromDate } from "@/lib/status";
import {
  Globe, Building2, Users, UserCheck, AlertTriangle, TrendingDown,
} from "lucide-react";

const AdminDashboard = () => {
  const { isSuperAdmin, loading } = useAuth();
  const { data: stats, isLoading } = useGlobalStats();

  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const statCards = [
    { label: "Painéis Ativos", value: stats?.activeTenants ?? 0, total: stats?.totalTenants, icon: Building2, color: "text-status-active" },
    { label: "Usuários", value: stats?.totalUsers ?? 0, icon: Users, color: "text-foreground" },
    { label: "Revendedores", value: stats?.resellers ?? 0, icon: UserCheck, color: "text-status-pre3" },
    { label: "Clientes", value: stats?.totalClients ?? 0, icon: Users, color: "text-status-pre1" },
    { label: "Inadimplentes", value: stats?.overdueClients ?? 0, icon: AlertTriangle, color: "text-status-expired" },
    { label: "Taxa Inadimplência", value: `${stats?.overdueRate ?? 0}%`, icon: TrendingDown, color: "text-status-post1" },
  ];

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
    </div>
  );
};

export default AdminDashboard;
