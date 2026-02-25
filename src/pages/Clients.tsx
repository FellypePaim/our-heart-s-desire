import { useState, useMemo, useEffect } from "react";
import { useClients } from "@/hooks/useClients";
import { useResellers } from "@/hooks/useResellers";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { getStatusFromDate } from "@/lib/status";
import { Client } from "@/lib/supabase-types";
import { StatusBadge } from "@/components/StatusBadge";
import { ClientDetailDialog } from "@/components/ClientDetailDialog";
import { AddClientDialog } from "@/components/AddClientDialog";
import { EditClientDialog } from "@/components/EditClientDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Users, ChevronLeft, ChevronRight, MessageSquare, Eye, EyeOff, Pencil, RefreshCw, Ban, CheckCircle, Trash2, CalendarDays } from "lucide-react";
import { WhatsAppMessageDialog } from "@/components/WhatsAppMessageDialog";
import { BulkWhatsAppDialog } from "@/components/BulkWhatsAppDialog";
import { BulkRenewDialog } from "@/components/BulkRenewDialog";
import { CSVImportExport } from "@/components/CSVImportExport";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const ITEMS_PER_PAGE = 20;

const Clients = () => {
  const { data: clients, isLoading } = useClients({ ownOnly: true });
  const { roles, user } = useAuth();
  const { hidden, toggle, mask } = usePrivacyMode();
  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const isSuperAdmin = roles.some((r) => r.role === "super_admin" && r.is_active);
  const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);
  const { data: resellers } = useResellers();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("mine");
  const [resellerFilter, setResellerFilter] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [messageClient, setMessageClient] = useState<Client | null>(null);
  const [page, setPage] = useState(1);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRenewOpen, setBulkRenewOpen] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const resellerMap = useMemo(() => {
    const map = new Map<string, string>();
    resellers?.forEach(r => map.set(r.id, r.display_name));
    return map;
  }, [resellers]);

  const filtered = useMemo(() => {
    if (!clients) return [];
    let result = clients;

    if (ownershipFilter === "mine") {
      result = result.filter((c) => c.user_id === user?.id);
    }
    if ((isPanelAdmin || isSuperAdmin) && resellerFilter !== "all") {
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
  }, [clients, search, ownershipFilter, resellerFilter, isPanelAdmin, isSuperAdmin, user?.id]);

  useEffect(() => { setPage(1); }, [search, ownershipFilter, resellerFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const title = isReseller ? "Meus Clientes" : "Clientes";

  const handleSendMessage = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    if (!client.phone) return;
    setMessageClient(client);
  };

  const handleRenewClient = async (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const currentDate = new Date(client.expiration_date + "T12:00:00");
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
      const newDateStr = newDate.toISOString().split("T")[0];

      const { error } = await supabase
        .from("clients")
        .update({ expiration_date: newDateStr })
        .eq("id", client.id);
      if (error) throw error;
      await logAudit(user.id, "client_renewed", "client", client.id, { old_date: client.expiration_date, new_date: newDateStr });
      toast({ title: "Renovado!", description: `${client.name} renovado até ${format(newDate, "dd/MM/yyyy", { locale: ptBR })}` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleSuspend = async (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const { error } = await supabase
        .from("clients")
        .update({ is_suspended: !client.is_suspended })
        .eq("id", client.id);
      if (error) throw error;
      await logAudit(user.id, client.is_suspended ? "client_unblocked" : "client_blocked", "client", client.id);
      toast({ title: client.is_suspended ? "Desbloqueado!" : "Bloqueado!" });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const openDeleteClient = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setDeletingClient(client);
    setDeleteDialogOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!deletingClient || !user) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", deletingClient.id);
      if (error) throw error;
      await logAudit(user.id, "client_deleted", "client", deletingClient.id, { name: deletingClient.name });
      toast({ title: "Excluído!", description: `${deletingClient.name} foi removido.` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDeleteDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const getCreatorName = (client: Client) => {
    if (client.reseller_id) {
      return resellerMap.get(client.reseller_id) || "-";
    }
    return "-";
  };

  const showCreator = isPanelAdmin || isSuperAdmin;

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 md:h-6 md:w-6" />
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} de {clients?.length || 0} clientes
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CSVImportExport clients={filtered} />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkRenewOpen(true)}>
            <CalendarDays className="h-4 w-4" />
            Renovar em Lote
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkOpen(true)}>
            <Users className="h-4 w-4" />
            Envio em Massa
          </Button>
          <Button variant="outline" size="icon" onClick={toggle} title={hidden ? "Mostrar dados sensíveis" : "Ocultar dados sensíveis"} className="h-9 w-9">
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <AddClientDialog />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone, plano, servidor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">Meus Clientes Finais</SelectItem>
            <SelectItem value="all">Todos os Clientes</SelectItem>
          </SelectContent>
        </Select>
        {(isPanelAdmin || isSuperAdmin) && resellers && resellers.length > 0 && (
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
              {showCreator && <TableHead>#Criador</TableHead>}
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={showCreator ? 7 : 6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showCreator ? 7 : 6} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell>
              </TableRow>
            ) : (
              paged.map((client) => {
                const status = getStatusFromDate(client.expiration_date);
                return (
                  <TableRow key={client.id} className="cursor-pointer" onClick={() => setSelectedClient(client)}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-muted-foreground">{mask(client.phone, "phone")}</TableCell>
                    <TableCell>{client.plan || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(client.expiration_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell><StatusBadge status={status} size="sm" /></TableCell>
                    {showCreator && (
                      <TableCell className="text-sm text-muted-foreground">{getCreatorName(client)}</TableCell>
                    )}
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditingClient(client); }} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleRenewClient(e, client)} title="Renovar (+1 mês)">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleSendMessage(e, client)} disabled={!client.phone} title="WhatsApp">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleToggleSuspend(e, client)} title={client.is_suspended ? "Desbloquear" : "Bloquear"}>
                          {client.is_suspended ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => openDeleteClient(e, client)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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

      <ClientDetailDialog client={selectedClient} open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)} />
      <EditClientDialog client={editingClient} open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)} />
      <WhatsAppMessageDialog client={messageClient} open={!!messageClient} onOpenChange={(open) => !open && setMessageClient(null)} />
      <BulkWhatsAppDialog clients={clients || []} open={bulkOpen} onOpenChange={setBulkOpen} />
      <BulkRenewDialog clients={clients || []} open={bulkRenewOpen} onOpenChange={setBulkRenewOpen} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingClient?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clients;
