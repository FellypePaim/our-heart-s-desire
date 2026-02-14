import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useResellers, Reseller } from "@/hooks/useResellers";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Pause, Play, Search, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";

const ITEMS_PER_PAGE = 20;

const Resellers = () => {
  const { user, roles, loading } = useAuth();
  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const tenantId = roles.find((r) => r.tenant_id && r.is_active)?.tenant_id;
  const { data: resellers, isLoading } = useResellers(tenantId);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [maxClients, setMaxClients] = useState(50);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [editName, setEditName] = useState("");
  const [editMaxClients, setEditMaxClients] = useState(50);
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReseller, setDeletingReseller] = useState<Reseller | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isSuperAdmin = roles.some((r) => r.role === "super_admin" && r.is_active);
  if (!loading && !isPanelAdmin && !isSuperAdmin) return <Navigate to="/" replace />;

  const filtered = resellers?.filter((r) =>
    r.display_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleCreate = async () => {
    if (!displayName.trim() || !email.trim() || !user || !tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("resellers").insert({
        tenant_id: tenantId,
        owner_user_id: user.id,
        display_name: displayName.trim(),
        limits: { max_clients: maxClients, max_messages_month: 500 },
      });

      if (error) throw error;

      await logAudit(user.id, "reseller_created", "reseller", undefined, { 
        display_name: displayName, tenant_id: tenantId 
      });
      toast({ title: "Revendedor criado!", description: `${displayName} foi cadastrado.` });
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
      setCreateOpen(false);
      setDisplayName("");
      setEmail("");
      setMaxClients(50);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (reseller: Reseller) => {
    if (!user) return;
    const newStatus = reseller.status === "active" ? "suspended" : "active";
    try {
      const { error } = await supabase
        .from("resellers")
        .update({ status: newStatus })
        .eq("id", reseller.id);
      if (error) throw error;
      await logAudit(user.id, `reseller_${newStatus}`, "reseller", reseller.id);
      toast({ title: newStatus === "active" ? "Reativado!" : "Suspenso!" });
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const openEdit = (reseller: Reseller) => {
    setEditingReseller(reseller);
    setEditName(reseller.display_name);
    setEditMaxClients(reseller.limits?.max_clients || 50);
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editingReseller || !user || !editName.trim()) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("resellers")
        .update({
          display_name: editName.trim(),
          limits: { ...editingReseller.limits, max_clients: editMaxClients },
        })
        .eq("id", editingReseller.id);
      if (error) throw error;
      await logAudit(user.id, "reseller_updated", "reseller", editingReseller.id, { display_name: editName });
      toast({ title: "Atualizado!", description: `${editName} foi atualizado.` });
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
      setEditOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const openDelete = (reseller: Reseller) => {
    setDeletingReseller(reseller);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingReseller || !user) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("resellers")
        .delete()
        .eq("id", deletingReseller.id);
      if (error) throw error;
      await logAudit(user.id, "reseller_deleted", "reseller", deletingReseller.id, { display_name: deletingReseller.display_name });
      toast({ title: "Excluído!", description: `${deletingReseller.display_name} foi removido.` });
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
      setDeleteDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 md:h-6 md:w-6" />
            Revendedores
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {resellers?.length || 0} revendedores cadastrados
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo Revendedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Revendedor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome de exibição *</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nome do revendedor" />
              </div>
              <div className="space-y-2">
                <Label>E-mail do usuário *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label>Máx. Clientes</Label>
                <Input type="number" value={maxClients} onChange={(e) => setMaxClients(Number(e.target.value))} />
              </div>
              <Button onClick={handleCreate} disabled={saving || !displayName.trim()} className="w-full">
                {saving ? "Criando..." : "Criar Revendedor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar revendedores..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead className="hidden md:table-cell">Limite</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum revendedor encontrado</TableCell></TableRow>
            ) : (
              paged.map((r) => (
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
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(r)}
                        title={r.status === "active" ? "Suspender" : "Reativar"}
                      >
                        {r.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDelete(r)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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

      {/* Edit Reseller Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Revendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome de exibição</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Máx. Clientes</Label>
              <Input type="number" value={editMaxClients} onChange={(e) => setEditMaxClients(Number(e.target.value))} />
            </div>
            <Button onClick={handleEdit} disabled={editSaving || !editName.trim()} className="w-full">
              {editSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir revendedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingReseller?.display_name}</strong>? Clientes vinculados podem ficar sem revendedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Resellers;
