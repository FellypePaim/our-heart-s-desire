import { useState, useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { getStatusFromDate, DASHBOARD_COLUMNS, getAllStatuses, StatusKey } from "@/lib/status";
import { Client } from "@/lib/supabase-types";
import { DashboardColumn } from "@/components/DashboardColumn";
import { ClientDetailDialog } from "@/components/ClientDetailDialog";
import { AddClientDialog } from "@/components/AddClientDialog";
import { ClientMetrics } from "@/components/radar/ClientMetrics";
import { ResellerMetrics } from "@/components/radar/ResellerMetrics";
import { ChurnRetentionChart } from "@/components/radar/ChurnRetentionChart";
import { RevenueForecast } from "@/components/radar/RevenueForecast";
import { OperationalLimits } from "@/components/OperationalLimits";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Radar, Eye, EyeOff, Users, Store, BarChart3, TrendingUp } from "lucide-react";

const Index = () => {
  const { data: clients, isLoading } = useClients({ ownOnly: true });
  const { roles } = useAuth();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { hidden, toggle, mask } = usePrivacyMode();

  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const isSuperAdmin = roles.some((r) => r.role === "super_admin" && r.is_active);
  const showResellerTab = isPanelAdmin || isSuperAdmin;

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

  const allStatuses = getAllStatuses();

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="border-b px-4 md:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Radar className="h-5 w-5 md:h-6 md:w-6 text-status-today" />
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Antecipe riscos antes que os problemas ocorram
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggle}
              title={hidden ? "Mostrar dados sensíveis" : "Ocultar dados sensíveis"}
              className="h-9 w-9"
            >
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <AddClientDialog />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="clients" className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4 md:px-6">
          <TabsList className="h-10 bg-transparent p-0 gap-4">
            <TabsTrigger
              value="clients"
              className="relative h-10 rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent gap-2"
            >
              <Users className="h-4 w-4" />
              Cliente Final
            </TabsTrigger>
            <TabsTrigger
              value="churn"
              className="relative h-10 rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Churn & Retenção
            </TabsTrigger>
            <TabsTrigger
              value="forecast"
              className="relative h-10 rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Previsão de Receita
            </TabsTrigger>
            {showResellerTab && (
              <TabsTrigger
                value="resellers"
                className="relative h-10 rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent gap-2"
              >
                <Store className="h-4 w-4" />
                Revendedores
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="clients" className="flex-1 overflow-hidden flex flex-col mt-0">
          <ClientMetrics clients={clients || []} isLoading={isLoading} mask={hidden ? mask : undefined} />
          <div className="px-4 md:px-6 pt-2">
            <OperationalLimits />
          </div>

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
                      maskPhone={hidden ? mask : undefined}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="churn" className="flex-1 overflow-auto mt-0 p-4 md:p-6">
          <ChurnRetentionChart clients={clients || []} />
        </TabsContent>

        <TabsContent value="forecast" className="flex-1 overflow-auto mt-0 p-4 md:p-6">
          <RevenueForecast clients={clients || []} mask={hidden ? mask : undefined} />
        </TabsContent>

        {showResellerTab && (
          <TabsContent value="resellers" className="flex-1 overflow-auto mt-0">
            <ResellerMetrics mask={hidden ? mask : undefined} />
          </TabsContent>
        )}
      </Tabs>

      <ClientDetailDialog
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
      />
    </div>
  );
};

export default Index;
