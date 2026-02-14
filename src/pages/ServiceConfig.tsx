import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllServiceOptions, useUpsertServiceOption, useDeleteServiceOption, ServiceOption } from "@/hooks/useServiceOptions";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Server, Plus, Pencil, Trash2 } from "lucide-react";

const categoryLabels: Record<string, string> = {
  plan: "Planos",
  server: "Servidores",
  app: "Aplicativos",
  device: "Dispositivos",
  captacao: "Captação",
};

const planConfigFields = [
  { key: "price", label: "Preço (R$)", type: "number" },
  { key: "credits", label: "Créditos", type: "number" },
  { key: "screens", label: "Telas", type: "number" },
  { key: "duration_months", label: "Duração (meses)", type: "number" },
];

const serverConfigFields = [
  { key: "cost_per_credit", label: "Custo por Crédito (R$)", type: "number" },
];

const ServiceConfig = () => {
  const { roles, loading, user } = useAuth();
  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const isSuperAdmin = roles.some((r) => r.role === "super_admin" && r.is_active);
  const tenantId = roles.find((r) => r.tenant_id && r.is_active)?.tenant_id;
  const { data: options, isLoading } = useAllServiceOptions();
  const upsert = useUpsertServiceOption();
  const deleteOpt = useDeleteServiceOption();
  const { toast } = useToast();

  const [tab, setTab] = useState("plan");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceOption | null>(null);
  const [formName, setFormName] = useState("");
  const [formConfig, setFormConfig] = useState<Record<string, any>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => options?.filter((o) => o.category === tab) || [], [options, tab]);

  if (!loading && !isPanelAdmin && !isSuperAdmin) return <Navigate to="/" replace />;

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormConfig(tab === "plan" ? { price: 0, credits: 1, screens: 1, duration_months: 1 } : tab === "server" ? { cost_per_credit: 0 } : tab === "captacao" ? {} : {});
    setEditOpen(true);
  };

  const openEdit = (opt: ServiceOption) => {
    setEditing(opt);
    setFormName(opt.name);
    setFormConfig(opt.config || {});
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    try {
      await upsert.mutateAsync({
        id: editing?.id,
        category: tab,
        name: formName.trim(),
        config: formConfig,
        tenant_id: editing?.tenant_id || (isSuperAdmin ? null : tenantId),
        is_global: editing?.is_global ?? isSuperAdmin,
      });
      toast({ title: editing ? "Atualizado!" : "Criado!", description: `${formName} salvo com sucesso.` });
      setEditOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteOpt.mutateAsync(deletingId);
      toast({ title: "Excluído!" });
      setDeleteOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const getConfigFields = () => {
    if (tab === "plan") return planConfigFields;
    if (tab === "server") return serverConfigFields;
    return [];
  };

  const canEdit = (opt: ServiceOption) => {
    if (isSuperAdmin) return true;
    if (opt.is_global) return false; // tenant admins can't edit global
    return isPanelAdmin && opt.tenant_id === tenantId;
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Server className="h-5 w-5 md:h-6 md:w-6" />
            Servidores & Planos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure planos, servidores, aplicativos e dispositivos
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo {categoryLabels[tab]?.slice(0, -1) || "Item"}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="plan">Planos</TabsTrigger>
          <TabsTrigger value="server">Servidores</TabsTrigger>
          <TabsTrigger value="app">Aplicativos</TabsTrigger>
          <TabsTrigger value="device">Dispositivos</TabsTrigger>
          <TabsTrigger value="captacao">Captação</TabsTrigger>
        </TabsList>

        {["plan", "server", "app", "device", "captacao"].map((cat) => (
          <TabsContent key={cat} value={cat}>
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    {cat === "plan" && (
                      <>
                        <TableHead>Preço</TableHead>
                        <TableHead>Créditos</TableHead>
                        <TableHead>Telas</TableHead>
                        <TableHead className="hidden md:table-cell">Duração</TableHead>
                      </>
                    )}
                    {cat === "server" && <TableHead>Custo/Crédito</TableHead>}
                    <TableHead>Escopo</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum item configurado</TableCell></TableRow>
                  ) : (
                    filtered.map((opt) => (
                      <TableRow key={opt.id}>
                        <TableCell className="font-medium">{opt.name}</TableCell>
                        {cat === "plan" && (
                          <>
                            <TableCell className="font-mono">R$ {opt.config?.price || 0}</TableCell>
                            <TableCell className="font-mono">{opt.config?.credits || 0}</TableCell>
                            <TableCell className="font-mono">{opt.config?.screens || 1}</TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">{opt.config?.duration_months || 1} mês(es)</TableCell>
                          </>
                        )}
                        {cat === "server" && (
                          <TableCell className="font-mono">R$ {opt.config?.cost_per_credit || 0}</TableCell>
                        )}
                        <TableCell>
                          <Badge variant={opt.is_global ? "default" : "secondary"}>
                            {opt.is_global ? "Global" : "Tenant"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {canEdit(opt) && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(opt)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { setDeletingId(opt.id); setDeleteOpen(true); }} title="Excluir">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
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
        ))}
      </Tabs>

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Criar"} {categoryLabels[tab]?.slice(0, -1)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome" />
            </div>
            {getConfigFields().map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input
                  type={field.type}
                  step={field.type === "number" ? "0.01" : undefined}
                  value={formConfig[field.key] ?? ""}
                  onChange={(e) => setFormConfig({ ...formConfig, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !formName.trim()}>
              {upsert.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este item?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServiceConfig;
