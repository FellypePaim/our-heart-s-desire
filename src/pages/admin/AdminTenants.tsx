import { useState } from "react";
import { useTenants } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Pause, Play, Edit2, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminTenants = () => {
  const { isSuperAdmin, loading, user } = useAuth();
  const { data: tenants, isLoading } = useTenants();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [maxResellers, setMaxResellers] = useState(10);
  const [maxClients, setMaxClients] = useState(100);
  const [maxMessages, setMaxMessages] = useState(1000);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const filtered = tenants?.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("tenants").insert({
        name: newName.trim(),
        max_resellers: maxResellers,
        max_clients: maxClients,
        max_messages_month: maxMessages,
      });
      if (error) throw error;
      await logAudit(user.id, "tenant_created", "tenant", undefined, { name: newName });
      toast({ title: "Painel criado!", description: `${newName} foi criado com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setCreateOpen(false);
      setNewName("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    if (!user) return;
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ status: newStatus })
        .eq("id", tenantId);
      if (error) throw error;
      await logAudit(user.id, `tenant_${newStatus}`, "tenant", tenantId);
      toast({ title: newStatus === "active" ? "Reativado!" : "Suspenso!" });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 md:h-6 md:w-6" />
            Gestão de Painéis
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tenants?.length || 0} painéis cadastrados
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo Painel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Painel</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Painel *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do painel" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Máx. Revendedores</Label>
                  <Input type="number" value={maxResellers} onChange={(e) => setMaxResellers(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Máx. Clientes</Label>
                  <Input type="number" value={maxClients} onChange={(e) => setMaxClients(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Máx. Msgs/Mês</Label>
                  <Input type="number" value={maxMessages} onChange={(e) => setMaxMessages(Number(e.target.value))} />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={saving || !newName.trim()} className="w-full">
                {saving ? "Criando..." : "Criar Painel"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar painéis..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Limites</TableHead>
              <TableHead className="hidden md:table-cell">Criado em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum painel encontrado</TableCell></TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "default" : "destructive"}>
                      {t.status === "active" ? "Ativo" : "Suspenso"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">
                    {t.max_resellers}R / {t.max_clients}C / {t.max_messages_month}M
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleStatus(t.id, t.status)}
                      title={t.status === "active" ? "Suspender" : "Reativar"}
                    >
                      {t.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
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

export default AdminTenants;
