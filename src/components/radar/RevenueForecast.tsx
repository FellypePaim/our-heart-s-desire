import { useMemo } from "react";
import { Client } from "@/lib/supabase-types";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { addDays, format, startOfDay, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface RevenueForecastProps {
  clients: Client[];
  mask?: (value: string | null | undefined, type: "phone" | "value" | "email" | "text") => string;
}

export function RevenueForecast({ clients, mask }: RevenueForecastProps) {
  const forecast = useMemo(() => {
    const today = startOfDay(new Date());

    // Active clients (not expired yet)
    const activeClients = clients.filter((c) => {
      const exp = new Date(c.expiration_date + "T12:00:00");
      return !isBefore(exp, today) && !c.is_suspended;
    });

    const currentRevenue = activeClients.reduce((sum, c) => sum + (c.valor || 0), 0);

    // Build daily projection for 90 days
    const dailyData: { day: string; otimista: number; realista: number; pessimista: number }[] = [];

    for (let d = 0; d <= 90; d++) {
      const targetDate = addDays(today, d);
      const dateStr = format(targetDate, "dd/MM", { locale: ptBR });

      // Count how many clients expire by this date
      const expiringByDate = activeClients.filter((c) => {
        const exp = new Date(c.expiration_date + "T12:00:00");
        return isBefore(exp, targetDate) || exp.getTime() === targetDate.getTime();
      });

      const expiringRevenue = expiringByDate.reduce((sum, c) => sum + (c.valor || 0), 0);

      // Scenarios
      const otimista = currentRevenue - (expiringRevenue * 0.1); // 90% renew
      const realista = currentRevenue - (expiringRevenue * 0.3); // 70% renew
      const pessimista = currentRevenue - (expiringRevenue * 0.5); // 50% renew

      dailyData.push({
        day: dateStr,
        otimista: Math.max(0, Math.round(otimista)),
        realista: Math.max(0, Math.round(realista)),
        pessimista: Math.max(0, Math.round(pessimista)),
      });
    }

    // Sample every 5 days for chart readability
    const sampled = dailyData.filter((_, i) => i % 5 === 0 || i === 30 || i === 60 || i === 90);

    // Summary at 30/60/90 days
    const at30 = dailyData[30] || dailyData[dailyData.length - 1];
    const at60 = dailyData[60] || dailyData[dailyData.length - 1];
    const at90 = dailyData[90] || dailyData[dailyData.length - 1];

    return { sampled, currentRevenue, at30, at60, at90 };
  }, [clients]);

  const fmt = (v: number) => {
    if (mask) return mask(String(v), "value");
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  };

  const summaryCards = [
    { label: "Receita Atual", value: forecast.currentRevenue, icon: Minus, color: "text-foreground" },
    { label: "30 dias (realista)", value: forecast.at30?.realista || 0, icon: TrendingUp, color: "text-blue-600" },
    { label: "60 dias (realista)", value: forecast.at60?.realista || 0, icon: TrendingUp, color: "text-amber-600" },
    { label: "90 dias (realista)", value: forecast.at90?.realista || 0, icon: TrendingDown, color: "text-status-expired" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-lg border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground truncate">{card.label}</span>
            </div>
            <p className="text-lg font-bold font-mono">{fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Area Chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">Projeção de Receita — 90 dias (clientes finais)</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={forecast.sampled}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) =>
                new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(v)
              }
            />
            <Tooltip
              formatter={(v: number, name: string) => [fmt(v), name.charAt(0).toUpperCase() + name.slice(1)]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="otimista"
              stroke="hsl(142, 60%, 40%)"
              fill="hsl(142, 60%, 40%)"
              fillOpacity={0.15}
              strokeWidth={2}
              name="Otimista (90% renovam)"
            />
            <Area
              type="monotone"
              dataKey="realista"
              stroke="hsl(220, 70%, 50%)"
              fill="hsl(220, 70%, 50%)"
              fillOpacity={0.15}
              strokeWidth={2}
              name="Realista (70% renovam)"
            />
            <Area
              type="monotone"
              dataKey="pessimista"
              stroke="hsl(0, 70%, 45%)"
              fill="hsl(0, 70%, 45%)"
              fillOpacity={0.15}
              strokeWidth={2}
              name="Pessimista (50% renovam)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario table */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Comparativo por Cenário</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-muted-foreground font-medium">Período</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Otimista</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Realista</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Pessimista</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Atual", data: { otimista: forecast.currentRevenue, realista: forecast.currentRevenue, pessimista: forecast.currentRevenue } },
                { label: "30 dias", data: forecast.at30 },
                { label: "60 dias", data: forecast.at60 },
                { label: "90 dias", data: forecast.at90 },
              ].map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-2 font-medium">{row.label}</td>
                  <td className="py-2 text-right font-mono text-status-active">{fmt(row.data?.otimista || 0)}</td>
                  <td className="py-2 text-right font-mono text-blue-600">{fmt(row.data?.realista || 0)}</td>
                  <td className="py-2 text-right font-mono text-status-expired">{fmt(row.data?.pessimista || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
