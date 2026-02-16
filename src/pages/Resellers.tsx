import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useResellers, Reseller } from "@/hooks/useResellers";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { validateWhatsAppPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Pause, Play, Search, ChevronLeft, ChevronRight, Pencil, Trash2, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UserProfile {
  id: string;
  email: string;
  name: string;
}

const ITEMS_PER_PAGE = 20;

const Resellers = () => {
  const { user, roles, loading } = useAuth();
  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const isSuperAdmin = roles.some((r) => r.role === "super_admin" && r.is_active);
  const { data: resellers, isLoading } = useResellers();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneError, setNewPhoneError] = useState("");
  const [newMaxClients, setNewMaxClients] = useState(50);
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [editName, setEditName] = useState("");
  const [editMaxClients, setEditMaxClients] = useState(50);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReseller, setDeletingReseller] = useState<Reseller | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const getOwnerName = (ownerUserId: string) => {
    if (ownerUserId === user?.id) return "Eu";
    const p = profileMap.get(ownerUserId);
    return p?.name || p?.email?.split("@")[0] || ownerUserId.slice(0, 8);
  };

  if (!loading && !isPanelAdmin && !isSuperAdmin) return <Navigate to="/" replace />;

  const filtered = resellers?.filter((r) => {
    const matchesSearch = r.display_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleCreate = async () => {
    if (!newDisplayName.trim() || !newEmail.trim() || !newPassword.trim() || !user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newEmail.trim(),
          password: newPassword,
          name: newDisplayName.trim(),
          role: "reseller",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (newMaxClients !== 50 && data?.user_id) {
        await supabase.from("resellers")
          .update({ limits: { max_clients: newMaxClients, max_messages_month: 500 } })
          .eq("owner_user_id", data.user_id);
      }

      await logAudit(user.id, "reseller_created", "reseller", undefined, { 
        display_name: newDisplayName, email: newEmail 
      });
      toast({ title: "Revendedor criado!", description: `${newDisplayName} (${newEmail}) foi cadastrado com acesso.` });
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
      if (isSuperAdmin) {
        const { data: profilesData } = await supabase.functions.invoke("get-user-profiles");
        if (profilesData) setProfiles(profilesData);
      }
      setCreateOpen(false);
      setNewDisplayName("");
      setNewEmail("");
      setNewPassword("");
      setNewMaxClients(50);
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

        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo Revendedor
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar revendedores..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v: "all" | "active" | "suspended") => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="suspended">Suspensos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead className="hidden md:table-cell">Limite</TableHead>
              <TableHead className="hidden md:table-cell">#Criador</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum revendedor encontrado</TableCell></TableRow>
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
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {getOwnerName(r.owner_user_id)}
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

      {/* Create Reseller Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Revendedor</DialogTitle>
            <DialogDescription>
              Crie uma conta de revendedor com acesso ao sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome de exibição *</Label>
              <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Nome do revendedor" />
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
              <Label>WhatsApp</Label>
              <Input
                value={newPhone}
                onChange={(e) => {
                  setNewPhone(e.target.value);
                  if (e.target.value.trim()) {
                    const { valid, error } = validateWhatsAppPhone(e.target.value);
                    setNewPhoneError(valid ? "" : error || "");
                  } else {
                    setNewPhoneError("");
                  }
                }}
                placeholder="(DD) 9XXXX-XXXX"
              />
              {newPhoneError && <p className="text-xs text-destructive">{newPhoneError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Máx. Clientes</Label>
              <Input type="number" value={newMaxClients} onChange={(e) => setNewMaxClients(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || !newDisplayName.trim() || !newEmail.trim() || !newPassword.trim()}>
              {saving ? "Criando..." : "Criar Revendedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={editSaving || !editName.trim()}>
              {editSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir revendedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingReseller?.display_name}</strong>? Esta ação não pode ser desfeita.
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
