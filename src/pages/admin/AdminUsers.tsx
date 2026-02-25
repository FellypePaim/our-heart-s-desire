import { useState, useMemo, useCallback, useEffect } from "react";
import { useAllUserRoles } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useResellers } from "@/hooks/useResellers";
import { useAllClients } from "@/hooks/useSuperAdmin";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { validateWhatsAppPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Shield, Search, Ban, CheckCircle, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download, UserCog, Trash2, Plus, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const roleLabels: Record<string, string> = {
  super_admin: "SuperAdmin",
  panel_admin: "Master",
  reseller: "Revendedor",
  user: "Cliente Final",
};

const roleRank: Record<string, number> = { user: 0, reseller: 1, panel_admin: 2, super_admin: 3 };

const ITEMS_PER_PAGE = 20;

type SortDir = "asc" | "desc" | null;
type SortState = { key: string; dir: SortDir };

interface UserProfile { id: string; email: string; name: string; created_at: string; }

function SortableHead({ label, sortKey, sort, onSort, className }: { label: string; sortKey: string; sort: SortState; onSort: (key: string) => void; className?: string }) {
  return (
    <TableHead className={className}>
      <button onClick={() => onSort(sortKey)} className="flex items-center gap-1 hover:text-foreground transition-colors">
        {label}
        {sort.key === sortKey ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : (<ArrowUpDown className="h-3 w-3 opacity-40" />)}
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
      if (typeof va === "string" && typeof vb === "string") return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sort.dir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [sort]);
  return { sort, toggle, sortFn };
}

const AdminUsers = () => {
  const { isSuperAdmin, loading, user } = useAuth();
  const { data: roles, isLoading } = useAllUserRoles();
  const { data: resellers } = useResellers();
  const { data: allClients } = useAllClients();
  const [search, setSearch] = useState("");
  const { hidden, toggle: togglePrivacy } = usePrivacyMode();
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState<{ userId: string; currentRole: string; roleId: string } | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<string>("");
  const [roleChanging, setRoleChanging] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<{ userId: string; roleId: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneError, setNewPhoneError] = useState("");
  const [newRole, setNewRole] = useState<string>("user");
  const [creating, setCreating] = useState(false);

  // Limits modal state
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [limitsUserId, setLimitsUserId] = useState<string | null>(null);
  const [limitsRole, setLimitsRole] = useState<string>("panel_admin");
  const [limitsMaxClients, setLimitsMaxClients] = useState(200);
  const [limitsMaxResellers, setLimitsMaxResellers] = useState(10);
  const [limitsMaxMessages, setLimitsMaxMessages] = useState(500);
  const [limitsSaving, setLimitsSaving] = useState(false);

  const allSort = useSort();

  useEffect(() => {
    if (!isSuperAdmin) return;
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-user-profiles");
        if (error) throw error;
        setProfiles(data || []);
      } catch (e: any) {
        console.error("Failed to fetch profiles:", e);
      }
    };
    fetchProfiles();
  }, [isSuperAdmin]);

  const getUserName = useCallback((userId: string) => {
    const p = profileMap.get(userId);
    return p?.name || p?.email?.split("@")[0] || userId.slice(0, 8);
  }, [profileMap]);

  const canActOn = useCallback((targetRole: string) => {
    return roleRank[targetRole] < roleRank["super_admin"];
  }, []);

  // Build owner options: masters and resellers
  const ownerOptions = useMemo(() => {
    const options: { id: string; label: string; type: "master" | "reseller" }[] = [];
    // Masters (panel_admin)
    const masters = roles?.filter((r) => r.role === "panel_admin") || [];
    masters.forEach((m) => {
      options.push({ id: m.user_id, label: `👤 ${getUserName(m.user_id)} (Master)`, type: "master" });
    });
    // Resellers
    resellers?.forEach((r) => {
      options.push({ id: r.owner_user_id, label: `🏪 ${r.display_name} (Revenda)`, type: "reseller" });
    });
    return options;
  }, [roles, resellers, getUserName]);

  // Build set of user_ids that belong to a selected owner
  const ownerUserIds = useMemo(() => {
    if (filterOwner === "all") return null;

    const ids = new Set<string>();
    ids.add(filterOwner); // Always include the owner themselves

    const ownerOption = ownerOptions.find((o) => o.id === filterOwner);
    if (!ownerOption) return ids;

    if (ownerOption.type === "master") {
      // Include resellers created by this master
      resellers?.forEach((r) => {
        if (r.created_by === filterOwner) {
          ids.add(r.owner_user_id);
        }
      });
      // Include clients owned directly by this master
      allClients?.forEach((c) => {
        if (c.user_id === filterOwner) {
          // Client records belong to this master - but these are records, not user accounts
          // We don't add client record IDs to user filter
        }
      });
    } else if (ownerOption.type === "reseller") {
      // Find the reseller record for this user
      const resellerRecord = resellers?.find((r) => r.owner_user_id === filterOwner);
      if (resellerRecord) {
        // The reseller themselves is already added
      }
    }

    return ids;
  }, [filterOwner, ownerOptions, resellers, allClients]);

  // Unified row type for both user_roles and clients
  type UnifiedRow = {
    id: string;
    user_id: string;
    role: string;
    is_active: boolean;
    created_at: string;
    displayName: string;
    source: "role" | "client";
    clientPhone?: string | null;
  };

  const filteredRoles = useMemo(() => {
    const rows: UnifiedRow[] = [];

    // Add user_roles entries (exclude "user" filter since those come from clients)
    if (filterRole !== "user") {
      (roles || []).forEach((r) => {
        if (filterRole !== "all" && r.role !== filterRole) return;
        if (ownerUserIds && !ownerUserIds.has(r.user_id)) return;
        if (search) {
          const q = search.toLowerCase();
          const name = getUserName(r.user_id).toLowerCase();
          if (!name.includes(q) && !r.user_id.toLowerCase().includes(q)) return;
        }
        rows.push({
          id: r.id,
          user_id: r.user_id,
          role: r.role,
          is_active: r.is_active,
          created_at: r.created_at,
          displayName: getUserName(r.user_id),
          source: "role",
        });
      });
    }

    // Add clients as "Cliente Final" rows
    if (filterRole === "all" || filterRole === "user") {
      (allClients || []).forEach((c) => {
        // Owner filter: match client's user_id (direct owner) or reseller's owner
        if (ownerUserIds) {
          const ownerOption = ownerOptions.find((o) => o.id === filterOwner);
          let matches = false;
          if (c.user_id === filterOwner) matches = true;
          if (c.reseller_id) {
            const resellerRecord = resellers?.find((r) => r.id === c.reseller_id);
            if (resellerRecord && resellerRecord.owner_user_id === filterOwner) matches = true;
            // If filtering by master, also include clients of resellers created by that master
            if (ownerOption?.type === "master" && resellerRecord && resellerRecord.created_by === filterOwner) matches = true;
          }
          if (!matches) return;
        }
        if (search) {
          const q = search.toLowerCase();
          if (!c.name.toLowerCase().includes(q) && !(c.phone || "").toLowerCase().includes(q)) return;
        }
        rows.push({
          id: `client_${c.id}`,
          user_id: c.user_id,
          role: "user",
          is_active: !c.is_suspended,
          created_at: c.created_at,
          displayName: c.name,
          source: "client",
          clientPhone: c.phone,
        });
      });
    }

    return allSort.sortFn(rows, (item, key) => {
      if (key === "name") return item.displayName;
      if (key === "role") return roleLabels[item.role] || item.role;
      if (key === "status") return item.is_active ? "Ativo" : "Bloqueado";
      if (key === "created_at") return item.created_at;
      return (item as any)[key];
    });
  }, [roles, allClients, filterRole, filterOwner, ownerUserIds, ownerOptions, resellers, search, allSort.sortFn, getUserName]);

  const filterKey = `${search}|${filterRole}|${filterOwner}`;
  useEffect(() => { setPage(1); }, [filterKey]);

  const exportCSV = useCallback(() => {
    const headers = ["Nome", "Cargo", "Status", "Data"];
    const rows = filteredRoles.map(r => [
      getUserName(r.user_id), roleLabels[r.role] || r.role,
      r.is_active ? "Ativo" : "Bloqueado",
      format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })
    ]);
    const bom = "\uFEFF";
    const csv = bom + [headers.join(";"), ...rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "usuarios.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportado!", description: "Arquivo CSV gerado com sucesso." });
  }, [filteredRoles, toast, getUserName]);

  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / ITEMS_PER_PAGE));
  const pagedRoles = filteredRoles.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const handleToggleActive = async (roleId: string, currentActive: boolean, userId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("user_roles").update({ is_active: !currentActive }).eq("id", roleId);
      if (error) throw error;
      await logAudit(user.id, currentActive ? "user_blocked" : "user_unblocked", "user_role", roleId, { target_user: userId });
      toast({ title: currentActive ? "Bloqueado!" : "Desbloqueado!" });
      queryClient.invalidateQueries({ queryKey: ["all_user_roles"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const openRoleModal = (userId: string, currentRole: string, roleId: string) => {
    setRoleModalUser({ userId, currentRole, roleId });
    setSelectedNewRole(currentRole);
    setRoleModalOpen(true);
  };

  const handleRoleChange = async () => {
    if (!roleModalUser || !user || !selectedNewRole || selectedNewRole === roleModalUser.currentRole) return;
    setRoleChanging(true);
    try {
      const { error } = await supabase.from("user_roles").update({ role: selectedNewRole as any }).eq("id", roleModalUser.roleId);
      if (error) throw error;
      await logAudit(user.id, "role_changed", "user_role", roleModalUser.roleId, {
        target_user: roleModalUser.userId, old_role: roleModalUser.currentRole, new_role: selectedNewRole,
      });
      toast({ title: "Cargo alterado!", description: `${getUserName(roleModalUser.userId)}: ${roleLabels[roleModalUser.currentRole]} → ${roleLabels[selectedNewRole]}` });
      queryClient.invalidateQueries({ queryKey: ["all_user_roles"] });
      setRoleModalOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setRoleChanging(false);
    }
  };

  const openDeleteDialog = (userId: string, roleId: string) => {
    setDeletingUser({ userId, roleId, name: getUserName(userId) });
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser || !user) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("user_roles").delete().eq("id", deletingUser.roleId);
      if (error) throw error;
      await logAudit(user.id, "user_role_deleted", "user_role", deletingUser.roleId, { target_user: deletingUser.userId });
      toast({ title: "Excluído!", description: `Cargo de ${deletingUser.name} removido.` });
      queryClient.invalidateQueries({ queryKey: ["all_user_roles"] });
      setDeleteDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const openLimitsModal = async (userId: string, role: string) => {
    setLimitsUserId(userId);
    setLimitsRole(role);
    if (role === "panel_admin") {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("limits")
          .eq("user_id", userId)
          .maybeSingle();
        const l = (data?.limits as any) || {};
        setLimitsMaxClients(l.max_clients ?? 200);
        setLimitsMaxResellers(l.max_resellers ?? 10);
      } catch {
        setLimitsMaxClients(200);
        setLimitsMaxResellers(10);
      }
    } else if (role === "reseller") {
      try {
        const { data } = await supabase
          .from("resellers")
          .select("limits")
          .eq("owner_user_id", userId)
          .maybeSingle();
        const l = (data?.limits as any) || {};
        setLimitsMaxClients(l.max_clients ?? 50);
        setLimitsMaxMessages(l.max_messages_month ?? 500);
      } catch {
        setLimitsMaxClients(50);
        setLimitsMaxMessages(500);
      }
    }
    setLimitsOpen(true);
  };

  const handleSaveLimits = async () => {
    if (!limitsUserId || !user) return;
    setLimitsSaving(true);
    try {
      if (limitsRole === "panel_admin") {
        const newLimits = { max_clients: limitsMaxClients, max_resellers: limitsMaxResellers };
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", limitsUserId)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("profiles")
            .update({ limits: newLimits as any })
            .eq("user_id", limitsUserId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("profiles")
            .insert({ user_id: limitsUserId, limits: newLimits as any });
          if (error) throw error;
        }
        await logAudit(user.id, "limits_updated", "user", limitsUserId, newLimits);
        toast({ title: "Limites atualizados!", description: `Máx. clientes: ${limitsMaxClients}, Máx. revendedores: ${limitsMaxResellers}` });
      } else if (limitsRole === "reseller") {
        const newLimits = { max_clients: limitsMaxClients, max_messages_month: limitsMaxMessages };
        const { error } = await supabase
          .from("resellers")
          .update({ limits: newLimits as any })
          .eq("owner_user_id", limitsUserId);
        if (error) throw error;
        await logAudit(user.id, "reseller_limits_updated", "reseller", limitsUserId, newLimits);
        toast({ title: "Limites atualizados!", description: `Máx. clientes: ${limitsMaxClients}, Máx. mensagens: ${limitsMaxMessages}` });
      }
      setLimitsOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLimitsSaving(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim() || !newPassword.trim() || !newRole) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newEmail.trim(),
          password: newPassword,
          name: newName.trim() || undefined,
          role: newRole,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await logAudit(user!.id, "user_created", "user", data.user_id, { email: newEmail, role: newRole });
      toast({ title: "Usuário criado!", description: `${newEmail} com cargo ${roleLabels[newRole]}` });
      queryClient.invalidateQueries({ queryKey: ["all_user_roles"] });
      const { data: profilesData } = await supabase.functions.invoke("get-user-profiles");
      if (profilesData) setProfiles(profilesData);
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewRole("user");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5 md:h-6 md:w-6" />
            Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredRoles.length} usuários • Visão completa do sistema
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por cargo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cargos</SelectItem>
            <SelectItem value="super_admin">SuperAdmin</SelectItem>
            <SelectItem value="panel_admin">Master</SelectItem>
            <SelectItem value="reseller">Revendedor</SelectItem>
            <SelectItem value="user">Cliente Final</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Filtrar por proprietário" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os proprietários</SelectItem>
            {ownerOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={togglePrivacy} title={hidden ? "Mostrar" : "Ocultar"} className="h-9 w-9">
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Nome" sortKey="name" sort={allSort.sort} onSort={allSort.toggle} />
              <SortableHead label="Cargo" sortKey="role" sort={allSort.sort} onSort={allSort.toggle} />
              <SortableHead label="Status" sortKey="status" sort={allSort.sort} onSort={allSort.toggle} />
              <SortableHead label="Data" sortKey="created_at" sort={allSort.sort} onSort={allSort.toggle} className="hidden md:table-cell" />
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filteredRoles.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
            ) : (
              pagedRoles.map((r) => {
                const canAct = r.source === "role" && canActOn(r.role);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{hidden ? "••••••••" : r.displayName}</TableCell>
                    <TableCell>
                      <Badge variant={r.role === "super_admin" ? "default" : "secondary"}>
                        {roleLabels[r.role] || r.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "default" : "destructive"}>
                        {r.is_active ? "Ativo" : (r.source === "client" ? "Suspenso" : "Bloqueado")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canAct && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openRoleModal(r.user_id, r.role, r.id)} title="Alterar cargo">
                              <UserCog className="h-4 w-4" />
                            </Button>
                            {(r.role === "panel_admin" || r.role === "reseller") && (
                              <Button variant="ghost" size="icon" onClick={() => openLimitsModal(r.user_id, r.role)} title="Configurar limites">
                                <SlidersHorizontal className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleToggleActive(r.id, r.is_active, r.user_id)} title={r.is_active ? "Bloquear" : "Desbloquear"}>
                              {r.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(r.user_id, r.id)} title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {r.source === "client" && (
                          <span className="text-xs text-muted-foreground italic flex items-center">Registro de cliente</span>
                        )}
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
          <span>{filteredRoles.length} registros • Página {page} de {totalPages}</span>
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

      {/* Create User Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Criar Novo Usuário</DialogTitle>
            <DialogDescription>Crie uma conta com cargo associado</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={newPhone}
                onChange={(e) => {
                  setNewPhone(e.target.value);
                  if (e.target.value.trim()) {
                    const { valid, error } = validateWhatsAppPhone(e.target.value);
                    setNewPhoneError(valid ? "" : error || "");
                  } else { setNewPhoneError(""); }
                }}
                placeholder="(DD) 9XXXX-XXXX"
              />
              {newPhoneError && <p className="text-xs text-destructive">{newPhoneError}</p>}
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha *</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Cargo *</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="panel_admin">Master</SelectItem>
                  <SelectItem value="reseller">Revendedor</SelectItem>
                  <SelectItem value="user">Cliente Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={creating || !newEmail.trim() || !newPassword.trim()}>
              {creating ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Modal */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> Alterar Cargo</DialogTitle>
            <DialogDescription>{roleModalUser && `Alterar cargo de ${getUserName(roleModalUser.userId)}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Cargo atual</p>
              <Badge variant="secondary" className="text-sm">{roleModalUser ? roleLabels[roleModalUser.currentRole] || roleModalUser.currentRole : ""}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Novo cargo</p>
              <Select value={selectedNewRole} onValueChange={setSelectedNewRole}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">SuperAdmin</SelectItem>
                  <SelectItem value="panel_admin">Master</SelectItem>
                  <SelectItem value="reseller">Revendedor</SelectItem>
                  <SelectItem value="user">Cliente Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleRoleChange} disabled={roleChanging || selectedNewRole === roleModalUser?.currentRole}>
              {roleChanging ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o cargo de <strong>{deletingUser?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Limits Modal */}
      <Dialog open={limitsOpen} onOpenChange={setLimitsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              {limitsRole === "panel_admin" ? "Limites do Master" : "Limites do Revendedor"}
            </DialogTitle>
            <DialogDescription>
              {limitsUserId && `Definir limites para ${getUserName(limitsUserId)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{limitsRole === "panel_admin" ? "Máx. Clientes Diretos" : "Máx. Clientes"}</Label>
              <Input type="number" min={1} value={limitsMaxClients} onChange={(e) => setLimitsMaxClients(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">
                {limitsRole === "panel_admin"
                  ? "Quantidade máxima de clientes que este Master pode cadastrar diretamente."
                  : "Quantidade máxima de clientes que este Revendedor pode cadastrar."}
              </p>
            </div>
            {limitsRole === "panel_admin" && (
              <div className="space-y-2">
                <Label>Máx. Revendedores</Label>
                <Input type="number" min={0} value={limitsMaxResellers} onChange={(e) => setLimitsMaxResellers(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">Quantidade máxima de revendedores que este Master pode criar.</p>
              </div>
            )}
            {limitsRole === "reseller" && (
              <div className="space-y-2">
                <Label>Máx. Mensagens/mês</Label>
                <Input type="number" min={0} value={limitsMaxMessages} onChange={(e) => setLimitsMaxMessages(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">Quantidade máxima de mensagens que este Revendedor pode enviar por mês.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitsOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLimits} disabled={limitsSaving}>
              {limitsSaving ? "Salvando..." : "Salvar Limites"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
