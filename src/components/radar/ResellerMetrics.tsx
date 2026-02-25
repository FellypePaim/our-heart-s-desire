import { useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { useResellers } from "@/hooks/useResellers";
import { useClients } from "@/hooks/useClients";
import { Users, UserCheck, UserX, BarChart3, DollarSign, TrendingUp, Download, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

interface ResellerMetricsProps {
  mask?: (value: string | null | undefined, type: "phone" | "value" | "email" | "text") => string;
}

export function ResellerMetrics({ mask }: ResellerMetricsProps) {
  const { data: resellers, isLoading } = useResellers();
  const { data: clients } = useClients({ ownOnly: true });

  const chartData = useMemo(() => {
    if (!resellers || resellers.length === 0) return { clientDist: [], revenueDist: [], statusDist: [] };

    const resellerIds = resellers.map((r) => r.id);
    const resellerClients = clients?.filter((c) => c.reseller_id && resellerIds.includes(c.reseller_id)) || [];

    const clientDist = resellers.map((r) => ({
      name: r.display_name.length > 12 ? r.display_name.slice(0, 12) + "…" : r.display_name,
      clientes: r.client_count || 0,
      receita: resellerClients.filter((c) => c.reseller_id === r.id).reduce((s, c) => s + (c.valor || 0), 0),
    })).sort((a, b) => b.clientes - a.clientes);

    const active = resellers.filter((r) => r.status === "active").length;
    const suspended = resellers.filter((r) => r.status === "suspended").length;
    const statusDist = [
      { name: "Ativos", value: active, color: "hsl(142, 60%, 40%)" },
      { name: "Suspensos", value: suspended, color: "hsl(0, 70%, 45%)" },
    ].filter((d) => d.value > 0);

    const revenueDist = resellers.map((r) => {
      const rev = resellerClients.filter((c) => c.reseller_id === r.id).reduce((s, c) => s + (c.valor || 0), 0);
      return {
        name: r.display_name.length > 12 ? r.display_name.slice(0, 12) + "…" : r.display_name,
        value: rev,
        color: r.status === "active" ? "hsl(142, 60%, 40%)" : "hsl(0, 70%, 45%)",
      };
    }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);

    return { clientDist, revenueDist, statusDist };
  }, [resellers, clients]);

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

  const resellerIds = resellers?.map((r) => r.id) || [];
  const resellerClients = clients?.filter((c) => c.reseller_id && resellerIds.includes(c.reseller_id)) || [];
  const totalResellerRevenue = resellerClients.reduce((sum, c) => sum + (c.valor || 0), 0);
  const avgRevenuePerReseller = total > 0 ? totalResellerRevenue / total : 0;

  const fmt = (v: number) => {
    if (mask) return mask(String(v), "value");
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  };

  const kpis = [
    { label: "Total Revendedores", value: String(total), icon: Users, color: "text-foreground" },
    { label: "Ativos", value: String(active), icon: UserCheck, color: "text-status-active" },
    { label: "Suspensos", value: String(suspended), icon: UserX, color: "text-status-expired" },
    { label: "Total Clientes (agregado)", value: String(totalClients), icon: BarChart3, color: "text-blue-600" },
    { label: "Média Clientes/Revendedor", value: String(avgClients), icon: BarChart3, color: "text-muted-foreground" },
    { label: "Receita Agregada", value: fmt(totalResellerRevenue), icon: DollarSign, color: "text-emerald-600" },
    { label: "Receita Média/Revendedor", value: fmt(avgRevenuePerReseller), icon: TrendingUp, color: "text-status-active" },
  ];

  const PIE_COLORS = ["hsl(220, 70%, 50%)", "hsl(142, 60%, 40%)", "hsl(45, 80%, 48%)", "hsl(280, 60%, 50%)", "hsl(15, 95%, 50%)", "hsl(190, 70%, 45%)", "hsl(0, 70%, 45%)", "hsl(320, 60%, 50%)"];

  const handleExportPDF = () => {
    if (!resellers) return;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Relatório de Saúde - Revendedores", 14, 22);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);

    const tableData = resellers.map((r) => {
      const limit = r.limits?.max_clients || 50;
      const usage = Math.round(((r.client_count || 0) / limit) * 100);
      const rClients = clients?.filter((c) => c.reseller_id === r.id) || [];
      const rRevenue = rClients.reduce((sum, c) => sum + (c.valor || 0), 0);
      return [
        r.display_name,
        r.status === "active" ? "Ativo" : "Suspenso",
        r.client_count || 0,
        fmt(rRevenue),
        limit,
        `${usage}%`
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [["Revendedor", "Status", "Clientes", "Receita", "Limite", "Uso"]],
      body: tableData,
    });

    doc.save("relatorio_revendedores.pdf");
  };

  const handleExportCSV = () => {
    if (!resellers) return;
    const headers = ["Revendedor,Status,Clientes,Receita,Limite,Uso%"];
    const rows = resellers.map((r) => {
      const limit = r.limits?.max_clients || 50;
      const usage = Math.round(((r.client_count || 0) / limit) * 100);
      const rClients = clients?.filter((c) => c.reseller_id === r.id) || [];
      const rRevenue = rClients.reduce((sum, c) => sum + (c.valor || 0), 0);
      return `"${r.display_name}",${r.status === "active" ? "Ativo" : "Suspenso"},${r.client_count || 0},"${fmt(rRevenue)}",${limit},${usage}`;
    });

    const csvContent = "\uFEFF" + headers.concat(rows).join("\n"); // Add BOM for Excel Portuguese support
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "relatorio_revendedores.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-sidebar-primary">Saúde dos Revendedores</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 glass">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
              <FileText className="h-4 w-4 text-red-500" />
              PDF White Label
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Planilha (CSV)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Status dos Revendedores</h3>
          {chartData.statusDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartData.statusDist} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {chartData.statusDist.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Revendedores"]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (<p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>)}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Receita por Revendedor</h3>
          {chartData.revenueDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartData.revenueDist} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${fmt(value)}`}>
                  {chartData.revenueDist.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(v: number) => [fmt(v), "Receita"]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (<p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>)}
        </div>

        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4">Clientes e Receita por Revendedor</h3>
          {chartData.clientDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.clientDist.length * 50)}>
              <BarChart data={chartData.clientDist} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 88%)" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number, name: string) => [name === "receita" ? fmt(v) : v, name === "receita" ? "Receita" : "Clientes"]} />
                <Legend />
                <Bar dataKey="clientes" fill="hsl(220, 70%, 50%)" name="Clientes" radius={[0, 4, 4, 0]} />
                <Bar dataKey="receita" fill="hsl(142, 60%, 40%)" name="Receita (R$)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (<p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>)}
        </div>
      </div>

      {resellers && resellers.length > 0 ? (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Revendedor</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Clientes</th>
                <th className="text-right px-4 py-3 font-medium">Receita</th>
                <th className="text-right px-4 py-3 font-medium">Limite</th>
                <th className="text-right px-4 py-3 font-medium">Uso %</th>
              </tr>
            </thead>
            <tbody>
              {resellers.map((r) => {
                const limit = r.limits?.max_clients || 50;
                const usage = Math.round(((r.client_count || 0) / limit) * 100);
                const rClients = clients?.filter((c) => c.reseller_id === r.id) || [];
                const rRevenue = rClients.reduce((sum, c) => sum + (c.valor || 0), 0);
                return (
                  <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{r.display_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.status === "active" ? "bg-status-active-bg text-status-active" : "bg-status-expired-bg text-status-expired"}`}>
                        {r.status === "active" ? "Ativo" : "Suspenso"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{r.client_count || 0}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(rRevenue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{limit}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${usage >= 90 ? "bg-status-expired" : usage >= 70 ? "bg-status-today" : "bg-status-active"}`} style={{ width: `${Math.min(usage, 100)}%` }} />
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
