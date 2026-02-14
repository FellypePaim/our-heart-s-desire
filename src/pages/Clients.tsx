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
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Users, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";

const ITEMS_PER_PAGE = 20;

const Clients = () => {
  const { data: clients, isLoading } = useClients();
  const { roles } = useAuth();
  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const tenantId = roles.find((r) => r.tenant_id && r.is_active)?.tenant_id;
  const { data: resellers } = useResellers(isPanelAdmin ? tenantId : undefined);
  
  const [search, setSearch] = useState("");
  const [resellerFilter, setResellerFilter] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!clients) return [];
    let result = clients;
    
    if (isPanelAdmin && resellerFilter !== "all") {
      result = result.filter((c) => c.reseller_id === resellerFilter);
    }
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          (c.plan || "").toLowerCase().includes(q) ||
          (c.servidor || "").toLowerCase().includes(q) ||
          (c.aplicativo || "").toLowerCase().includes(q) ||
          (c.captacao || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [clients, search, resellerFilter, isPanelAdmin]);

  // Reset page on filter change
  useMemo(() => { setPage(1); }, [search, resellerFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);
  const title = isReseller ? "Meus Clientes" : "Clientes";

  const handleSendMessage = (e: React.MouseEvent, phone?: string | null) => {
    e.stopPropagation();
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  };

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
            placeholder="Buscar por nome, telefone, plano, servidor..."
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
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            ) : (
              paged.map((client) => {
                const status = getStatusFromDate(client.expiration_date);
                return (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedClient(client)}
                  >
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-muted-foreground">{client.phone || "-"}</TableCell>
                    <TableCell>{client.plan || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(client.expiration_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} size="sm" />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => handleSendMessage(e, client.phone)}
                        disabled={!client.phone}
                        title="Enviar mensagem via WhatsApp"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-3 text-sm text-muted-foreground">
          <span>{filtered.length} registros • Página {page} de {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ClientDetailDialog
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
      />
    </div>
  );
};

export default Clients;
