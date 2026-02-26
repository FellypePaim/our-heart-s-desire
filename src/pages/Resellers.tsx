import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useResellers, Reseller } from "@/hooks/useResellers";
import { useClients } from "@/hooks/useClients";
import { useCredits } from "@/hooks/useCredits";
import { Navigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Users, Plus, Pause, Play, Search, ChevronLeft, ChevronRight, Pencil, Trash2, Filter, AlertTriangle, Download, FileText, FileSpreadsheet, RefreshCw, Calendar, Coins } from "lucide-react";
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
  const { data: clients } = useClients();
  const { balance: creditBalance, invalidate: invalidateCredits } = useCredits();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneError, setNewPhoneError] = useState("");
  
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReseller, setDeletingReseller] = useState<Reseller | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [renewOpen, setRenewOpen] = useState(false);
  const [renewingReseller, setRenewingReseller] = useState<Reseller | null>(null);
  const [renewDate, setRenewDate] = useState("");
  const [renewSaving, setRenewSaving] = useState(false);

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [planMap, setPlanMap] = useState<Map<string, { plan_type: string; plan_expires_at: string }>>(new Map());
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!isSuperAdmin) return; // Only super_admin can call get-user-profiles
      try {
        const { data, error } = await supabase.functions.invoke("get-user-profiles");
        if (error) throw error;
        setProfiles(data || []);
      } catch (e: any) {
        console.error("Failed to fetch profiles:", e);
      }
    };
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, plan_type, plan_expires_at");
        if (error) throw error;
        setPlanMap(new Map((data || []).map((p: any) => [p.user_id, p])));
      } catch (e: any) {
        console.error("Failed to fetch plans:", e);
      }
    };
    fetchProfiles();
    fetchPlans();
  }, []);

  const getCreatorName = (createdBy: string | null) => {
    if (!createdBy) return "—";
    if (createdBy === user?.id) return "Eu";
    const p = profileMap.get(createdBy);
    return p?.name || p?.email?.split("@")[0] || createdBy.slice(0, 8);
  };

  if (!loading && !isPanelAdmin && !isSuperAdmin) return <Navigate to="/" replace />;

  const filtered = resellers?.filter((r) => {
    // SuperAdmin only sees their own resellers here (use Admin > Users for global view)
    if (isSuperAdmin && r.created_by !== user?.id) return false;
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


      await logAudit(user.id, "reseller_created", "reseller", undefined, {
        display_name: newDisplayName, email: newEmail
      });
      toast({ title: "Revendedor criado!", description: `${newDisplayName} (${newEmail}) foi cadastrado com acesso.` });
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
      invalidateCredits();
      if (isSuperAdmin) {
        const { data: profilesData } = await supabase.functions.invoke("get-user-profiles");
        if (profilesData) setProfiles(profilesData);
      }
      setCreateOpen(false);
      setNewDisplayName("");
      setNewEmail("");
      setNewPassword("");
      
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

  const handleExportPDF = () => {
    if (!resellers) return;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Relatório de Saúde - Revendedores", 14, 22);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);

    const tableData = resellers.map((r) => {
      const rClients = clients?.filter((c) => c.reseller_id === r.id) || [];
      const rRevenue = rClients.reduce((sum, c) => sum + (c.valor || 0), 0);
      const fmtRev = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(rRevenue);
      return [
        r.display_name,
        r.status === "active" ? "Ativo" : "Suspenso",
        r.client_count || 0,
        fmtRev,
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [["Revendedor", "Status", "Clientes", "Receita"]],
      body: tableData,
    });

    doc.save("relatorio_revendedores.pdf");
  };

  const handleExportCSV = () => {
    if (!resellers) return;
    const headers = ["Revendedor,Status,Clientes,Receita"];
    const rows = resellers.map((r) => {
      const rClients = clients?.filter((c) => c.reseller_id === r.id) || [];
      const rRevenue = rClients.reduce((sum, c) => sum + (c.valor || 0), 0);
      const fmtRev = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(rRevenue);
      return `"${r.display_name}",${r.status === "active" ? "Ativo" : "Suspenso"},${r.client_count || 0},"${fmtRev}"`;
    });

    const csvContent = "\uFEFF" + headers.concat(rows).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "relatorio_revendedores.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        {isPanelAdmin && (
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">{creditBalance} créditos</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 glass">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4 text-red-500" />
                PDF White Label
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Planilha (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Revendedor
          </Button>
        </div>
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
              <TableHead>Vencimento</TableHead>
              <TableHead className="hidden md:table-cell">#Criador</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum revendedor encontrado</TableCell></TableRow>
            ) : (
              paged.map((r) => {
                const plan = planMap.get(r.owner_user_id);
                const expiresAt = plan?.plan_expires_at ? new Date(plan.plan_expires_at) : null;
                const expired = expiresAt ? isPast(expiresAt) : true;
                return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div>{r.display_name}</div>
                    {profileMap.get(r.owner_user_id)?.email && (
                      <span className="text-xs text-muted-foreground">{profileMap.get(r.owner_user_id)?.email}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "active" ? "default" : "destructive"}>
                      {r.status === "active" ? "Ativo" : "Suspenso"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{r.client_count || 0}</TableCell>
                  <TableCell>
                    {expiresAt ? (
                      <div className="text-sm">
                        <Badge variant={expired ? "destructive" : "outline"} className="text-xs">
                          {format(expiresAt, "dd/MM/yyyy", { locale: ptBR })}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {expired
                            ? `Expirou ${formatDistanceToNow(expiresAt, { locale: ptBR, addSuffix: true })}`
                            : `Expira ${formatDistanceToNow(expiresAt, { locale: ptBR, addSuffix: true })}`}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {getCreatorName(r.created_by)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        setRenewingReseller(r);
                        setRenewDate("");
                        setRenewOpen(true);
                      }} title="Renovar plano">
                        <RefreshCw className="h-4 w-4" />
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

      {/* Renew Reseller Dialog — credit-based for Masters, manual for SA */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renovar Plano do Revendedor</DialogTitle>
            <DialogDescription>
              Renove o plano de <strong>{renewingReseller?.display_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isPanelAdmin && !isSuperAdmin ? (
              <>
                <div className="rounded-lg border bg-muted/50 p-3 flex items-center gap-3">
                  <Coins className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">Saldo: {creditBalance} créditos</p>
                    <p className="text-xs text-muted-foreground">1 crédito = +30 dias</p>
                  </div>
                </div>
                <Button
                  className="w-full gap-2"
                  disabled={renewSaving || creditBalance < 1}
                  onClick={async () => {
                    if (!renewingReseller || !user) return;
                    setRenewSaving(true);
                    try {
                      const { error } = await supabase.rpc("spend_credit_renew_reseller", {
                        _master_user_id: user.id,
                        _reseller_user_id: renewingReseller.owner_user_id,
                      });
                      if (error) throw error;
                      await logAudit(user.id, "reseller_plan_renewed_credit", "reseller", renewingReseller.id, { credit_spent: 1 });
                      toast({ title: "Renovado!", description: `Plano de ${renewingReseller.display_name} renovado por +30 dias (1 crédito usado).` });
                      invalidateCredits();
                      const { data: freshPlans } = await supabase.from("profiles").select("user_id, plan_type, plan_expires_at");
                      if (freshPlans) setPlanMap(new Map(freshPlans.map((p: any) => [p.user_id, p])));
                      setRenewOpen(false);
                    } catch (e: any) {
                      toast({ title: "Erro", description: e.message, variant: "destructive" });
                    } finally {
                      setRenewSaving(false);
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  {creditBalance < 1 ? "Sem créditos disponíveis" : "Gastar 1 crédito (+30 dias)"}
                </Button>
                {creditBalance < 1 && (
                  <p className="text-xs text-destructive text-center">
                    Solicite mais créditos ao administrador para renovar revendedores.
                  </p>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  disabled={renewSaving}
                  onClick={async () => {
                    if (!renewingReseller || !user) return;
                    setRenewSaving(true);
                    try {
                      const currentPlan = planMap.get(renewingReseller.owner_user_id);
                      const currentExpiry = currentPlan?.plan_expires_at ? new Date(currentPlan.plan_expires_at) : null;
                      const base = currentExpiry && currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
                      const newExpiry = new Date(base);
                      newExpiry.setDate(newExpiry.getDate() + 30);
                      const { error } = await supabase
                        .from("profiles")
                        .update({ plan_type: "monthly", plan_expires_at: newExpiry.toISOString() })
                        .eq("user_id", renewingReseller.owner_user_id);
                      if (error) throw error;
                      await logAudit(user.id, "reseller_plan_renewed", "reseller", renewingReseller.id, { days: 30 });
                      toast({ title: "Renovado!", description: `Plano de ${renewingReseller.display_name} renovado por +30 dias.` });
                      const { data: freshPlans } = await supabase.from("profiles").select("user_id, plan_type, plan_expires_at");
                      if (freshPlans) setPlanMap(new Map(freshPlans.map((p: any) => [p.user_id, p])));
                      setRenewOpen(false);
                    } catch (e: any) {
                      toast({ title: "Erro", description: e.message, variant: "destructive" });
                    } finally {
                      setRenewSaving(false);
                    }
                  }}
                >
                  <Calendar className="h-4 w-4" />
                  Renovar +30 dias
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex-1 h-px bg-border" />
                  ou selecione a data
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="flex gap-2">
                  <Input type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} className="flex-1" />
                  <Button
                    disabled={!renewDate || renewSaving}
                    onClick={async () => {
                      if (!renewingReseller || !user || !renewDate) return;
                      setRenewSaving(true);
                      try {
                        const expiry = new Date(renewDate + "T23:59:59");
                        const { error } = await supabase
                          .from("profiles")
                          .update({ plan_type: "monthly", plan_expires_at: expiry.toISOString() })
                          .eq("user_id", renewingReseller.owner_user_id);
                        if (error) throw error;
                        await logAudit(user.id, "reseller_plan_renewed", "reseller", renewingReseller.id, { date: renewDate });
                        toast({ title: "Renovado!", description: `Plano de ${renewingReseller.display_name} renovado até ${renewDate}.` });
                        const { data: freshPlans } = await supabase.from("profiles").select("user_id, plan_type, plan_expires_at");
                        if (freshPlans) setPlanMap(new Map(freshPlans.map((p: any) => [p.user_id, p])));
                        setRenewOpen(false);
                      } catch (e: any) {
                        toast({ title: "Erro", description: e.message, variant: "destructive" });
                      } finally {
                        setRenewSaving(false);
                      }
                    }}
                  >
                    {renewSaving ? "Salvando..." : "Renovar"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Resellers;
