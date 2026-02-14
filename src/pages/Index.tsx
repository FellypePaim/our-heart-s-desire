import { useState, useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { getStatusFromDate, DASHBOARD_COLUMNS, getAllStatuses, StatusKey } from "@/lib/status";
import { Client } from "@/lib/supabase-types";
import { DashboardColumn } from "@/components/DashboardColumn";
import { ClientDetailDialog } from "@/components/ClientDetailDialog";
import { AddClientDialog } from "@/components/AddClientDialog";
import { Radar, Users, AlertTriangle, CheckCircle } from "lucide-react";

const Index = () => {
  const { data: clients, isLoading } = useClients();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const groupedClients = useMemo(() => {
    if (!clients) return {} as Record<StatusKey, Client[]>;
    const groups: Record<StatusKey, Client[]> = {
      active: [], pre3: [], pre2: [], pre1: [],
      today: [], post1: [], post2: [], expired: [],
    };
    clients.forEach((c) => {
      const status = getStatusFromDate(c.expiration_date);
      groups[status.key].push(c);
    });
    return groups;
  }, [clients]);

  const stats = useMemo(() => {
    if (!clients) return { total: 0, urgent: 0, active: 0, overdue: 0 };
    const urgent = (groupedClients.today?.length || 0) + (groupedClients.pre1?.length || 0);
    const overdue = (groupedClients.post1?.length || 0) + (groupedClients.post2?.length || 0) + (groupedClients.expired?.length || 0);
    const active = groupedClients.active?.length || 0;
    return { total: clients.length, urgent, active, overdue };
  }, [clients, groupedClients]);

  const allStatuses = getAllStatuses();

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="border-b px-4 md:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Radar className="h-5 w-5 md:h-6 md:w-6 text-status-today" />
              Radar Operacional
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Antecipe riscos antes que os problemas ocorram
            </p>
          </div>
          <AddClientDialog />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[
            { label: "Total", value: stats.total, icon: Users, color: "text-foreground" },
            { label: "Ativos", value: stats.active, icon: CheckCircle, color: "text-status-active" },
            { label: "Urgentes", value: stats.urgent, icon: AlertTriangle, color: "text-status-today" },
            { label: "Atrasados", value: stats.overdue, icon: AlertTriangle, color: "text-status-expired" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-xl md:text-2xl font-bold font-mono">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <div className="flex gap-4 h-full">
            {DASHBOARD_COLUMNS.map((key) => {
              const statusConfig = allStatuses.find((s) => s.key === key)!;
              return (
                <DashboardColumn
                  key={key}
                  status={statusConfig}
                  clients={groupedClients[key] || []}
                  onClientClick={setSelectedClient}
                />
              );
            })}
          </div>
        )}
      </div>

      <ClientDetailDialog
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
      />
    </div>
  );
};

export default Index;
