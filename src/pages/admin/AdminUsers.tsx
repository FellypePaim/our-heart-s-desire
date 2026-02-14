import { useState } from "react";
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
import { Shield, Search, Ban, CheckCircle, Eye, Pencil, RefreshCw, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getStatusFromDate } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { Client } from "@/lib/supabase-types";
import { Reseller } from "@/hooks/useResellers";

const roleLabels: Record<string, string> = {
  super_admin: "SuperAdmin",
  panel_admin: "Master",
  reseller: "Revendedor",
  user: "Cliente Final",
};

const AdminUsers = () => {
  const { isSuperAdmin, loading, user, setImpersonating } = useAuth();
  const { data: roles, isLoading } = useAllUserRoles();
  const { data: tenants } = useTenants();
  const { data: allClients, isLoading: clientsLoading } = useAllClients();
  const { data: allResellers, isLoading: resellersLoading } = useResellers();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const tenantMap = new Map(tenants?.map((t) => [t.id, t.name]) || []);

  // Build a map of user_id -> role label
  const userRoleMap = new Map<string, string>();
  roles?.forEach((r) => {
    const existing = userRoleMap.get(r.user_id);
    // Priority: super_admin > panel_admin > reseller > user
    const priority: Record<string, number> = { super_admin: 4, panel_admin: 3, reseller: 2, user: 1 };
    if (!existing || (priority[r.role] || 0) > (priority[existing] || 0)) {
      userRoleMap.set(r.user_id, r.role);
    }
  });

  // --- Tab: Todos (all user_roles) ---
  const filteredRoles = roles?.filter((r) => {
    if (filterRole !== "all" && r.role !== filterRole) return false;
    if (search && !r.user_id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  // --- Tab: Clientes ---
  const filteredClients = allClients?.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.plan.toLowerCase().includes(q);
  }) || [];

  // --- Tab: Revendedores ---
  const filteredResellers = allResellers?.filter((r) => {
    if (!search) return true;
    return r.display_name.toLowerCase().includes(search.toLowerCase());
  }) || [];

  // --- Tab: Masters ---
  const masterRoles = roles?.filter((r) => r.role === "panel_admin") || [];
  const filteredMasters = masterRoles.filter((r) => {
    if (!search) return true;
    return r.user_id.toLowerCase().includes(search.toLowerCase());
  });

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

  const handleRenewClient = async (client: Client) => {
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

        {/* Search bar - shared */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
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
        </div>

        {/* Tab: Todos */}
        <TabsContent value="all" className="mt-4">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="hidden md:table-cell">Painel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filteredRoles.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
                ) : (
                  filteredRoles.map((r) => (
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
        </TabsContent>

        {/* Tab: Clientes Finais */}
        <TabsContent value="clients" className="mt-4">
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
                {clientsLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filteredClients.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
                ) : (
                  filteredClients.map((client) => {
                    const status = getStatusFromDate(client.expiration_date);
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell className="text-muted-foreground">{client.phone || "-"}</TableCell>
                        <TableCell>{client.plan}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(client.expiration_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={status} size="sm" />
                        </TableCell>
                        <TableCell>
                          <ActionButtons
                            onEdit={() => toast({ title: "Editar", description: `Editar ${client.name}` })}
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
        </TabsContent>

        {/* Tab: Revendedores */}
        <TabsContent value="resellers" className="mt-4">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead className="hidden md:table-cell">Limite</TableHead>
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
                  filteredResellers.map((r) => (
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
        </TabsContent>

        {/* Tab: Masters */}
        <TabsContent value="masters" className="mt-4">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Painel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filteredMasters.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum master encontrado</TableCell></TableRow>
                ) : (
                  filteredMasters.map((r) => (
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminUsers;
