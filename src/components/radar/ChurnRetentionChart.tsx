import { useMemo } from "react";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate } from "@/lib/status";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChurnRetentionChartProps {
  clients: Client[];
}

export function ChurnRetentionChart({ clients }: ChurnRetentionChartProps) {
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: {
      month: string;
      novos: number;
      ativos: number;
      vencidos: number;
      retencao: number;
    }[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const label = format(monthDate, "MMM/yy", { locale: ptBR });

      // Novos: created_at within month
      const novos = clients.filter((c) =>
        isWithinInterval(new Date(c.created_at), { start: monthStart, end: monthEnd })
      ).length;

      // Clientes que estavam ativos naquele mês (vencimento > inicio do mês)
      const activeDuringMonth = clients.filter((c) => {
        const exp = new Date(c.expiration_date + "T12:00:00");
        const created = new Date(c.created_at);
        return created <= monthEnd && exp >= monthStart;
      });

      // Vencidos: expiration_date within month (lost)
      const vencidos = clients.filter((c) => {
        const exp = new Date(c.expiration_date + "T12:00:00");
        return isWithinInterval(exp, { start: monthStart, end: monthEnd }) && exp < now;
      }).length;

      const ativos = activeDuringMonth.length;
      const retencao = ativos > 0 ? Math.round(((ativos - vencidos) / ativos) * 100) : 100;

      months.push({ month: label, novos, ativos, vencidos, retencao });
    }

    return months;
  }, [clients]);

  return (
    <div className="space-y-6">
      {/* Churn Bar Chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">Clientes Novos vs Perdidos (últimos 6 meses)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="novos" fill="hsl(142, 60%, 40%)" name="Novos" radius={[4, 4, 0, 0]} />
            <Bar dataKey="vencidos" fill="hsl(0, 70%, 45%)" name="Perdidos" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Retention Line Chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">Taxa de Retenção Mensal (%)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
            <Tooltip formatter={(v: number) => [`${v}%`, "Retenção"]} />
            <Line
              type="monotone"
              dataKey="retencao"
              stroke="hsl(220, 70%, 50%)"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Retenção"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
