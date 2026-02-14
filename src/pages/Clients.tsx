import { useState, useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { useResellers } from "@/hooks/useResellers";
import { useAuth } from "@/hooks/useAuth";
import { getStatusFromDate } from "@/lib/status";
import { Client } from "@/lib/supabase-types";
import { StatusBadge } from "@/components/StatusBadge";
import { ClientDetailDialog } from "@/components/ClientDetailDialog";
import { AddClientDialog } from "@/components/AddClientDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Users } from "lucide-react";

const Clients = () => {
  const { data: clients, isLoading } = useClients();
  const { roles } = useAuth();
  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);
  const tenantId = roles.find((r) => r.tenant_id && r.is_active)?.tenant_id;
  const { data: resellers } = useResellers(isPanelAdmin ? tenantId : undefined);
  
  const [search, setSearch] = useState("");
  const [resellerFilter, setResellerFilter] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const filtered = useMemo(() => {
    if (!clients) return [];
    let result = clients;
    
    // Filter by reseller (panel admin only)
    if (isPanelAdmin && resellerFilter !== "all") {
      result = result.filter((c) => c.reseller_id === resellerFilter);
    }
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.plan.toLowerCase().includes(q)
      );
    }
    return result;
  }, [clients, search, resellerFilter, isPanelAdmin]);

  const title = isReseller ? "Meus Clientes" : "Clientes";

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 md:h-6 md:w-6" />
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clients?.length || 0} clientes cadastrados
          </p>
        </div>
        <AddClientDialog />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou plano..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isPanelAdmin && resellers && resellers.length > 0 && (
          <Select value={resellerFilter} onValueChange={setResellerFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar revendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os revendedores</SelectItem>
              {resellers.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((client) => {
                const status = getStatusFromDate(client.expiration_date);
                return (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedClient(client)}
                  >
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-muted-foreground">{client.phone || "-"}</TableCell>
                    <TableCell>{client.plan}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(client.expiration_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} size="sm" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ClientDetailDialog
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
      />
    </div>
  );
};

export default Clients;
