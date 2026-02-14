import { useAuditLogs } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Crown, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

const AdminAudit = () => {
  const { isSuperAdmin, loading } = useAuth();
  const { data: logs, isLoading } = useAuditLogs();
  const [search, setSearch] = useState("");

  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const filtered = logs?.filter((l) =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.target_type?.toLowerCase().includes(search.toLowerCase()) ||
    l.user_id.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="h-5 w-5 md:h-6 md:w-6" />
          Auditoria
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Logs de ações críticas do sistema
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar ações..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>User ID</TableHead>
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
                    {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[100px] truncate">{log.user_id.slice(0, 8)}...</TableCell>
                  <TableCell className="font-medium text-sm">{log.action}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{log.target_type || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
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
