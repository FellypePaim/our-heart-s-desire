import { useState, useMemo, useCallback } from "react";
import { useAllUserRoles, useTenants, useAllClients } from "@/hooks/useSuperAdmin";
import { useResellers } from "@/hooks/useResellers";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Shield, Search, Ban, CheckCircle, Eye, Pencil, RefreshCw, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download, Filter, X } from "lucide-react";
import { getAllStatuses, type StatusKey } from "@/lib/status";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getStatusFromDate } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { Client } from "@/lib/supabase-types";
import { EditClientDialog } from "@/components/EditClientDialog";

const roleLabels: Record<string, string> = {
  super_admin: "SuperAdmin",
  panel_admin: "Master",
  reseller: "Revendedor",
  user: "Cliente Final",
};

const ITEMS_PER_PAGE = 20;

type SortDir = "asc" | "desc" | null;
type SortState = { key: string; dir: SortDir };

function SortableHead({ label, sortKey, sort, onSort, className }: { label: string; sortKey: string; sort: SortState; onSort: (key: string) => void; className?: string }) {
  return (
    <TableHead className={className}>
      <button onClick={() => onSort(sortKey)} className="flex items-center gap-1 hover:text-foreground transition-colors">
        {label}
        {sort.key === sortKey ? (
          sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

function useSort(initial: string = "") {
  const [sort, setSort] = useState<SortState>({ key: initial, dir: null });

  const toggle = useCallback((key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      if (prev.dir === "desc") return { key: "", dir: null };
      return { key, dir: "asc" };
    });
  }, []);

  const sortFn = useCallback(<T,>(items: T[], accessor: (item: T, key: string) => any): T[] => {
    if (!sort.key || !sort.dir) return items;
    return [...items].sort((a, b) => {
      const va = accessor(a, sort.key);
      const vb = accessor(b, sort.key);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string" && typeof vb === "string") {
        return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sort.dir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [sort]);

  return { sort, toggle, sortFn };
}

const AdminUsers = () => {
  const { isSuperAdmin, loading, user, setImpersonating } = useAuth();
  const { data: roles, isLoading } = useAllUserRoles();
  const { data: tenants } = useTenants();
  const { data: allClients, isLoading: clientsLoading } = useAllClients();
  const { data: allResellers, isLoading: resellersLoading } = useResellers();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");
  const [editingClient, setEditingClient] = useState<any>(null);
  const [pageAll, setPageAll] = useState(1);
  const [pageClients, setPageClients] = useState(1);
  const [pageResellers, setPageResellers] = useState(1);
  const [pageMasters, setPageMasters] = useState(1);
  // Advanced filters for clients tab
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterServidor, setFilterServidor] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const clientSort = useSort();
  const resellerSort = useSort();
  const masterSort = useSort();
  const allSort = useSort();

  const tenantMap = useMemo(() => new Map(tenants?.map((t) => [t.id, t.name]) || []), [tenants]);

  // Unique servidores for filter
  const uniqueServidores = useMemo(() => {
    const set = new Set<string>();
    allClients?.forEach((c: any) => { if (c.servidor) set.add(c.servidor); });
    return Array.from(set).sort();
  }, [allClients]);

  // --- Filtered data ---
  const filteredRoles = useMemo(() => {
    const list = roles?.filter((r) => {
      if (filterRole !== "all" && r.role !== filterRole) return false;
      if (search && !r.user_id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }) || [];
    return allSort.sortFn(list, (item, key) => {
      if (key === "role") return roleLabels[item.role] || item.role;
      if (key === "status") return item.is_active ? "Ativo" : "Bloqueado";
      if (key === "created_at") return item.created_at;
      return (item as any)[key];
    });
  }, [roles, filterRole, search, allSort.sortFn]);

  const filteredClients = useMemo(() => {
    const list = allClients?.filter((c: any) => {
      // Text search
      if (search) {
        const q = search.toLowerCase();
        const matches = c.name.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          (c.plan || "").toLowerCase().includes(q) ||
          (c.servidor || "").toLowerCase().includes(q) ||
          (c.aplicativo || "").toLowerCase().includes(q) ||
          (c.captacao || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      // Status filter
      if (filterStatus !== "all") {
        const st = getStatusFromDate(c.expiration_date);
        if (st.key !== filterStatus) return false;
      }
      // Servidor filter
      if (filterServidor !== "all") {
        if ((c.servidor || "") !== filterServidor) return false;
      }
      // Date range filter
      if (filterDateFrom) {
        const exp = new Date(c.expiration_date + "T12:00:00");
        if (exp < filterDateFrom) return false;
      }
      if (filterDateTo) {
        const exp = new Date(c.expiration_date + "T12:00:00");
        if (exp > filterDateTo) return false;
      }
      return true;
    }) || [];
    return clientSort.sortFn(list, (item: any, key) => {
      if (key === "status") return getStatusFromDate(item.expiration_date).label;
      if (key === "valor") return Number(item.valor) || 0;
      if (key === "telas") return Number(item.telas) || 0;
      return item[key];
    });
  }, [allClients, search, filterStatus, filterServidor, filterDateFrom, filterDateTo, clientSort.sortFn]);

  const filteredResellers = useMemo(() => {
    const list = allResellers?.filter((r) => {
      if (!search) return true;
      return r.display_name.toLowerCase().includes(search.toLowerCase());
    }) || [];
    return resellerSort.sortFn(list, (item, key) => {
      if (key === "client_count") return item.client_count || 0;
      if (key === "display_name") return item.display_name;
      if (key === "status") return item.status;
      if (key === "limit") return item.limits?.max_clients || 0;
      return (item as any)[key];
    });
  }, [allResellers, search, resellerSort.sortFn]);

  const filteredMasters = useMemo(() => {
    const masterRoles = roles?.filter((r) => r.role === "panel_admin") || [];
    const list = masterRoles.filter((r) => {
      if (!search) return true;
      return r.user_id.toLowerCase().includes(search.toLowerCase());
    });
    return masterSort.sortFn(list, (item, key) => {
      if (key === "status") return item.is_active ? "Ativo" : "Bloqueado";
      if (key === "tenant") return item.tenant_id ? tenantMap.get(item.tenant_id) || "" : "";
      return (item as any)[key];
    });
  }, [roles, search, masterSort.sortFn, tenantMap]);

  // Reset pages on search/filter change
  useMemo(() => { setPageAll(1); setPageClients(1); setPageResellers(1); setPageMasters(1); }, [search, filterRole, filterStatus, filterServidor, filterDateFrom, filterDateTo]);

  // CSV export helper
  const exportCSV = useCallback((filename: string, headers: string[], rows: string[][]) => {
    const bom = "\uFEFF";
    const csv = bom + [headers.join(";"), ...rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportCurrentTab = useCallback(() => {
    if (activeTab === "all") {
      exportCSV("usuarios", ["User ID", "Cargo", "Painel", "Status", "Data"], filteredRoles.map(r => [
        r.user_id, roleLabels[r.role] || r.role, r.tenant_id ? tenantMap.get(r.tenant_id) || r.tenant_id : "",
        r.is_active ? "Ativo" : "Bloqueado", format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })
      ]));
    } else if (activeTab === "clients") {
      exportCSV("clientes", ["Nome", "Telefone", "Vencimento", "Plano", "Valor", "Status", "Servidor", "Telas", "Aplicativo", "Dispositivo", "Captação"],
        filteredClients.map((c: any) => [
          c.name, c.phone || "", format(new Date(c.expiration_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }),
          c.plan || "", c.valor ? Number(c.valor).toFixed(2).replace(".", ",") : "",
          getStatusFromDate(c.expiration_date).label, c.servidor || "", String(c.telas ?? ""),
          c.aplicativo || "", c.dispositivo || "", c.captacao || ""
        ]));
    } else if (activeTab === "resellers") {
      exportCSV("revendedores", ["Nome", "Status", "Clientes", "Limite", "Painel"], filteredResellers.map(r => [
        r.display_name, r.status === "active" ? "Ativo" : "Suspenso", String(r.client_count || 0),
        String(r.limits?.max_clients || "∞"), tenantMap.get(r.tenant_id) || r.tenant_id
      ]));
    } else if (activeTab === "masters") {
      exportCSV("masters", ["User ID", "Painel", "Status", "Data"], filteredMasters.map(r => [
        r.user_id, r.tenant_id ? tenantMap.get(r.tenant_id) || r.tenant_id : "",
        r.is_active ? "Ativo" : "Bloqueado", format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })
      ]));
    }
    toast({ title: "Exportado!", description: "Arquivo CSV gerado com sucesso." });
  }, [activeTab, filteredRoles, filteredClients, filteredResellers, filteredMasters, tenantMap, exportCSV, toast]);

  const hasActiveFilters = filterStatus !== "all" || filterServidor !== "all" || !!filterDateFrom || !!filterDateTo;
  const clearFilters = () => { setFilterStatus("all"); setFilterServidor("all"); setFilterDateFrom(undefined); setFilterDateTo(undefined); };

  // Pagination helpers
  const paginate = <T,>(items: T[], page: number) => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return items.slice(start, start + ITEMS_PER_PAGE);
  };
  const totalPages = (total: number) => Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const pagedRoles = paginate(filteredRoles, pageAll);
  const pagedClients = paginate(filteredClients, pageClients);
  const pagedResellers = paginate(filteredResellers, pageResellers);
  const pagedMasters = paginate(filteredMasters, pageMasters);

  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const handleToggleActive = async (roleId: string, currentActive: boolean, userId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ is_active: !currentActive })
        .eq("id", roleId);
      if (error) throw error;
      await logAudit(user.id, currentActive ? "user_blocked" : "user_unblocked", "user_role", roleId, { target_user: userId });
      toast({ title: currentActive ? "Bloqueado!" : "Desbloqueado!" });
      queryClient.invalidateQueries({ queryKey: ["all_user_roles"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleImpersonate = async (targetUserId: string, tenantId: string | null) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from("impersonate_sessions").insert({
        super_admin_id: user.id,
        target_user_id: targetUserId,
        target_tenant_id: tenantId,
      }).select("id").single();
      if (error) throw error;
      await logAudit(user.id, "impersonate_start", "user", targetUserId, { tenant_id: tenantId });
      setImpersonating({ userId: targetUserId, tenantId, sessionId: data.id });
      toast({ title: "Modo Suporte", description: "Você está agora em modo impersonate." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleSendMessage = (name: string, phone?: string | null) => {
    if (!phone) {
      toast({ title: "Sem WhatsApp", description: `${name} não possui número cadastrado.`, variant: "destructive" });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  };

  const handleRenewClient = async (client: any) => {
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
      queryClient.invalidateQueries({ queryKey: ["all_clients"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const PaginationBar = ({ page, total, setPage }: { page: number; total: number; setPage: (p: number) => void }) => {
    const tp = totalPages(total);
    if (tp <= 1) return null;
    return (
      <div className="flex items-center justify-between px-2 py-3 text-sm text-muted-foreground">
        <span>{total} registros • Página {page} de {tp}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= tp} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const ActionButtons = ({ onEdit, onRenew, onMessage }: { onEdit?: () => void; onRenew?: () => void; onMessage?: () => void }) => (
    <div className="flex gap-1">
      {onEdit && (
        <Button variant="ghost" size="icon" onClick={onEdit} title="Editar">
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {onRenew && (
        <Button variant="ghost" size="icon" onClick={onRenew} title="Renovar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
      {onMessage && (
        <Button variant="ghost" size="icon" onClick={onMessage} title="Enviar mensagem">
          <MessageSquare className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-5 w-5 md:h-6 md:w-6" />
          Gestão de Usuários
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visão completa de todos os usuários do sistema
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="clients">Clientes Finais</TabsTrigger>
          <TabsTrigger value="resellers">Revendedores</TabsTrigger>
          <TabsTrigger value="masters">Masters</TabsTrigger>
        </TabsList>

        <div className="flex flex-col gap-3 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {activeTab === "all" && (
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="super_admin">SuperAdmin</SelectItem>
                  <SelectItem value="panel_admin">Master</SelectItem>
                  <SelectItem value="reseller">Revendedor</SelectItem>
                  <SelectItem value="user">Cliente Final</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={exportCurrentTab} className="gap-2">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>

          {/* Advanced filters for clients tab */}
          {activeTab === "clients" && (
            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {getAllStatuses().map(s => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterServidor} onValueChange={setFilterServidor}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Servidor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos servidores</SelectItem>
                  {uniqueServidores.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1">
                    {filterDateFrom ? format(filterDateFrom, "dd/MM/yy") : "De"} – {filterDateTo ? format(filterDateTo, "dd/MM/yy") : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground font-medium">Vencimento de:</p>
                    <Calendar mode="single" selected={filterDateFrom} onSelect={setFilterDateFrom} locale={ptBR} />
                    <p className="text-xs text-muted-foreground font-medium">Até:</p>
                    <Calendar mode="single" selected={filterDateTo} onSelect={setFilterDateTo} locale={ptBR} />
                  </div>
                </PopoverContent>
              </Popover>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs gap-1">
                  <X className="h-3 w-3" /> Limpar filtros
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Tab: Todos */}
        <TabsContent value="all" className="mt-4">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="User ID" sortKey="user_id" sort={allSort.sort} onSort={allSort.toggle} />
                  <SortableHead label="Cargo" sortKey="role" sort={allSort.sort} onSort={allSort.toggle} />
                  <SortableHead label="Painel" sortKey="tenant_id" sort={allSort.sort} onSort={allSort.toggle} className="hidden md:table-cell" />
                  <SortableHead label="Status" sortKey="status" sort={allSort.sort} onSort={allSort.toggle} />
                  <SortableHead label="Data" sortKey="created_at" sort={allSort.sort} onSort={allSort.toggle} className="hidden md:table-cell" />
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filteredRoles.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
                ) : (
                  pagedRoles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate">{r.user_id}</TableCell>
                      <TableCell>
                        <Badge variant={r.role === "super_admin" ? "default" : "secondary"}>
                          {roleLabels[r.role] || r.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {r.tenant_id ? tenantMap.get(r.tenant_id) || r.tenant_id.slice(0, 8) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? "default" : "destructive"}>
                          {r.is_active ? "Ativo" : "Bloqueado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleToggleActive(r.id, r.is_active, r.user_id)} title={r.is_active ? "Bloquear" : "Desbloquear"}>
                            {r.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {r.role !== "super_admin" && (
                            <Button variant="ghost" size="icon" onClick={() => handleImpersonate(r.user_id, r.tenant_id)} title="Impersonate">
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationBar page={pageAll} total={filteredRoles.length} setPage={setPageAll} />
        </TabsContent>

        {/* Tab: Clientes Finais */}
        <TabsContent value="clients" className="mt-4">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Nome" sortKey="name" sort={clientSort.sort} onSort={clientSort.toggle} />
                  <SortableHead label="Telefone" sortKey="phone" sort={clientSort.sort} onSort={clientSort.toggle} />
                  <SortableHead label="Vencimento" sortKey="expiration_date" sort={clientSort.sort} onSort={clientSort.toggle} />
                  <SortableHead label="Plano" sortKey="plan" sort={clientSort.sort} onSort={clientSort.toggle} />
                  <SortableHead label="Valor" sortKey="valor" sort={clientSort.sort} onSort={clientSort.toggle} />
                  <SortableHead label="Status" sortKey="status" sort={clientSort.sort} onSort={clientSort.toggle} />
                  <SortableHead label="Servidor" sortKey="servidor" sort={clientSort.sort} onSort={clientSort.toggle} />
                  <SortableHead label="Telas" sortKey="telas" sort={clientSort.sort} onSort={clientSort.toggle} />
                  <SortableHead label="Aplicativo" sortKey="aplicativo" sort={clientSort.sort} onSort={clientSort.toggle} className="hidden lg:table-cell" />
                  <SortableHead label="Dispositivo" sortKey="dispositivo" sort={clientSort.sort} onSort={clientSort.toggle} className="hidden lg:table-cell" />
                  <SortableHead label="Captação" sortKey="captacao" sort={clientSort.sort} onSort={clientSort.toggle} className="hidden lg:table-cell" />
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsLoading ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filteredClients.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
                ) : (
                  pagedClients.map((client: any) => {
                    const status = getStatusFromDate(client.expiration_date);
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell className="text-muted-foreground">{client.phone || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(client.expiration_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{client.plan}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {client.valor ? `R$ ${Number(client.valor).toFixed(2).replace(".", ",")}` : "-"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={status} size="sm" />
                        </TableCell>
                        <TableCell className="text-sm">{client.servidor || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">{client.telas ?? "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{client.aplicativo || "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{client.dispositivo || "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{client.captacao || "-"}</TableCell>
                        <TableCell>
                          <ActionButtons
                            onEdit={() => setEditingClient(client)}
                            onRenew={() => handleRenewClient(client)}
                            onMessage={() => handleSendMessage(client.name, client.phone)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationBar page={pageClients} total={filteredClients.length} setPage={setPageClients} />
        </TabsContent>

        {/* Tab: Revendedores */}
        <TabsContent value="resellers" className="mt-4">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Nome" sortKey="display_name" sort={resellerSort.sort} onSort={resellerSort.toggle} />
                  <SortableHead label="Status" sortKey="status" sort={resellerSort.sort} onSort={resellerSort.toggle} />
                  <SortableHead label="Clientes" sortKey="client_count" sort={resellerSort.sort} onSort={resellerSort.toggle} />
                  <SortableHead label="Limite" sortKey="limit" sort={resellerSort.sort} onSort={resellerSort.toggle} className="hidden md:table-cell" />
                  <TableHead className="hidden md:table-cell">Painel</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resellersLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filteredResellers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum revendedor encontrado</TableCell></TableRow>
                ) : (
                  pagedResellers.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.display_name}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "active" ? "default" : "destructive"}>
                          {r.status === "active" ? "Ativo" : "Suspenso"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{r.client_count || 0}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">
                        {r.limits?.max_clients || "∞"} clientes
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {tenantMap.get(r.tenant_id) || r.tenant_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <ActionButtons
                          onEdit={() => toast({ title: "Editar", description: `Editar ${r.display_name}` })}
                          onMessage={() => toast({ title: "Mensagem", description: `Enviar mensagem para ${r.display_name}` })}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationBar page={pageResellers} total={filteredResellers.length} setPage={setPageResellers} />
        </TabsContent>

        {/* Tab: Masters */}
        <TabsContent value="masters" className="mt-4">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="User ID" sortKey="user_id" sort={masterSort.sort} onSort={masterSort.toggle} />
                  <SortableHead label="Painel" sortKey="tenant" sort={masterSort.sort} onSort={masterSort.toggle} />
                  <SortableHead label="Status" sortKey="status" sort={masterSort.sort} onSort={masterSort.toggle} />
                  <SortableHead label="Data" sortKey="created_at" sort={masterSort.sort} onSort={masterSort.toggle} className="hidden md:table-cell" />
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filteredMasters.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum master encontrado</TableCell></TableRow>
                ) : (
                  pagedMasters.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate">{r.user_id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.tenant_id ? tenantMap.get(r.tenant_id) || r.tenant_id.slice(0, 8) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? "default" : "destructive"}>
                          {r.is_active ? "Ativo" : "Bloqueado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleToggleActive(r.id, r.is_active, r.user_id)} title={r.is_active ? "Bloquear" : "Desbloquear"}>
                            {r.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleImpersonate(r.user_id, r.tenant_id)} title="Impersonate">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationBar page={pageMasters} total={filteredMasters.length} setPage={setPageMasters} />
        </TabsContent>
      </Tabs>

      <EditClientDialog
        client={editingClient}
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
      />
    </div>
  );
};

export default AdminUsers;
