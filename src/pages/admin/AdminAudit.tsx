import { useAuditLogs } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  id: string;
  email: string;
  name: string;
}

const actionLabels: Record<string, string> = {
  client_created: "Cliente criado",
  client_renewed: "Cliente renovado",
  client_blocked: "Cliente bloqueado",
  client_unblocked: "Cliente desbloqueado",
  client_deleted: "Cliente excluído",
  client_updated: "Cliente editado",
  reseller_created: "Revendedor criado",
  reseller_updated: "Revendedor editado",
  reseller_deleted: "Revendedor excluído",
  reseller_active: "Revendedor reativado",
  reseller_suspended: "Revendedor suspenso",
  user_created: "Usuário criado",
  user_blocked: "Usuário bloqueado",
  user_unblocked: "Usuário desbloqueado",
  user_role_deleted: "Cargo removido",
  role_changed: "Cargo alterado",
  
};

const AdminAudit = () => {
  const { isSuperAdmin, loading } = useAuth();
  const { data: logs, isLoading } = useAuditLogs();
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.functions.invoke("get-user-profiles").then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, [isSuperAdmin]);

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const getUserName = (userId: string) => {
    const p = profileMap.get(userId);
    return p?.name || p?.email?.split("@")[0] || userId.slice(0, 8);
  };

  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const uniqueActions = [...new Set(logs?.map(l => l.action) || [])].sort();

  const filtered = logs?.filter((l) => {
    if (filterAction !== "all" && l.action !== filterAction) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.action.toLowerCase().includes(q) ||
        l.target_type?.toLowerCase().includes(q) ||
        getUserName(l.user_id).toLowerCase().includes(q) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(q)
      );
    }
    return true;
  }) || [];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="h-5 w-5 md:h-6 md:w-6" />
          Log de Atividades
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Histórico completo de ações do sistema ({logs?.length || 0} registros)
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por usuário, ação, detalhes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filtrar ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {uniqueActions.map(a => (
              <SelectItem key={a} value={a}>{actionLabels[a] || a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead className="hidden md:table-cell">Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum log encontrado</TableCell></TableRow>
            ) : (
              filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{getUserName(log.user_id)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {actionLabels[log.action] || log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{log.target_type || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[300px] truncate">
                    {log.details && Object.keys(log.details).length > 0
                      ? JSON.stringify(log.details)
                      : "-"}
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

export default AdminAudit;
