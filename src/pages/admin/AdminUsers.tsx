import { useState } from "react";
import { useAllUserRoles, useTenants } from "@/hooks/useSuperAdmin";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Shield, Search, Ban, CheckCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const roleLabels: Record<string, string> = {
  super_admin: "SuperAdmin",
  panel_admin: "Admin Painel",
  reseller: "Revendedor",
  user: "Usuário",
};

const AdminUsers = () => {
  const { isSuperAdmin, loading, user, setImpersonating } = useAuth();
  const { data: roles, isLoading } = useAllUserRoles();
  const { data: tenants } = useTenants();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const tenantMap = new Map(tenants?.map((t) => [t.id, t.name]) || []);

  const filtered = roles?.filter((r) => {
    if (filterRole !== "all" && r.role !== filterRole) return false;
    if (search && !r.user_id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

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

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-5 w-5 md:h-6 md:w-6" />
          Gestão de Usuários
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {roles?.length || 0} roles cadastrados
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="super_admin">SuperAdmin</SelectItem>
            <SelectItem value="panel_admin">Admin Painel</SelectItem>
            <SelectItem value="reseller">Revendedor</SelectItem>
            <SelectItem value="user">Usuário</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Painel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Data</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
            ) : (
              filtered.map((r) => (
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(r.id, r.is_active, r.user_id)}
                        title={r.is_active ? "Bloquear" : "Desbloquear"}
                      >
                        {r.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </Button>
                      {r.role !== "super_admin" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleImpersonate(r.user_id, r.tenant_id)}
                          title="Impersonate"
                        >
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
    </div>
  );
};

export default AdminUsers;
