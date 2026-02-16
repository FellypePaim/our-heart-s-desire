import { useResellers } from "@/hooks/useResellers";
import { useAuth } from "@/hooks/useAuth";
import { Users, UserCheck, UserX, BarChart3 } from "lucide-react";

export function ResellerMetrics() {
  const { roles } = useAuth();
  const tenantId = roles.find((r) => r.tenant_id && r.is_active)?.tenant_id;
  const { data: resellers, isLoading } = useResellers(tenantId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando métricas de revendedores...
      </div>
    );
  }

  const total = resellers?.length || 0;
  const active = resellers?.filter((r) => r.status === "active").length || 0;
  const suspended = resellers?.filter((r) => r.status === "suspended").length || 0;
  const totalClients = resellers?.reduce((sum, r) => sum + (r.client_count || 0), 0) || 0;
  const avgClients = total > 0 ? Math.round(totalClients / total) : 0;

  const kpis = [
    { label: "Total Revendedores", value: total, icon: Users, color: "text-foreground" },
    { label: "Ativos", value: active, icon: UserCheck, color: "text-status-active" },
    { label: "Suspensos", value: suspended, icon: UserX, color: "text-status-expired" },
    { label: "Total Clientes (agregado)", value: totalClients, icon: BarChart3, color: "text-blue-600" },
    { label: "Média Clientes/Revendedor", value: avgClients, icon: BarChart3, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 overflow-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <span className="text-xs text-muted-foreground truncate">{kpi.label}</span>
            </div>
            <p className="text-lg md:text-xl font-bold font-mono">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Reseller Table */}
      {resellers && resellers.length > 0 ? (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Revendedor</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Clientes</th>
                <th className="text-right px-4 py-3 font-medium">Limite</th>
                <th className="text-right px-4 py-3 font-medium">Uso %</th>
              </tr>
            </thead>
            <tbody>
              {resellers.map((r) => {
                const limit = r.limits?.max_clients || 50;
                const usage = Math.round(((r.client_count || 0) / limit) * 100);
                return (
                  <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{r.display_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.status === "active"
                          ? "bg-status-active-bg text-status-active"
                          : "bg-status-expired-bg text-status-expired"
                      }`}>
                        {r.status === "active" ? "Ativo" : "Suspenso"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{r.client_count || 0}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{limit}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              usage >= 90 ? "bg-status-expired" : usage >= 70 ? "bg-status-today" : "bg-status-active"
                            }`}
                            style={{ width: `${Math.min(usage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground w-8">{usage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Nenhum revendedor encontrado
        </div>
      )}
    </div>
  );
}
