import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useAllServiceOptions, useUpsertServiceOption, useDeleteServiceOption, ServiceOption } from "@/hooks/useServiceOptions";
import { useToast } from "@/hooks/use-toast";
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
  plan: "Planos", server: "Servidores", app: "Aplicativos",
  device: "Dispositivos", pagamento: "Formas de Pagamento", captacao: "Captação",
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

const AdminServiceConfig = () => {
  const { isSuperAdmin, loading } = useAuth();
  const { data: allOptions, isLoading } = useAllServiceOptions();
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

  // Only show global items
  const filtered = useMemo(() =>
    allOptions?.filter((o) => o.category === tab && o.is_global) || [],
    [allOptions, tab]
  );

  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormConfig(tab === "plan" ? { price: 0, credits: 1, screens: 1, duration_months: 1 } : tab === "server" ? { cost_per_credit: 0 } : {});
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
        created_by: null,
        is_global: true,
      });
      toast({ title: editing ? "Atualizado!" : "Criado!", description: `${formName} salvo como padrão global.` });
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

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Server className="h-5 w-5 md:h-6 md:w-6" />
            Configurações Globais de Serviços
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Defina os padrões globais de planos, servidores, aplicativos, dispositivos, pagamentos e captação
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo {categoryLabels[tab]?.slice(0, -1) || "Item"} Global
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="plan">Planos</TabsTrigger>
          <TabsTrigger value="server">Servidores</TabsTrigger>
          <TabsTrigger value="app">Aplicativos</TabsTrigger>
          <TabsTrigger value="device">Dispositivos</TabsTrigger>
          <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
          <TabsTrigger value="captacao">Captação</TabsTrigger>
        </TabsList>

        {["plan", "server", "app", "device", "pagamento", "captacao"].map((cat) => (
          <TabsContent key={cat} value={cat}>
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    {cat === "plan" && (<><TableHead>Preço</TableHead><TableHead>Créditos</TableHead><TableHead>Telas</TableHead><TableHead className="hidden md:table-cell">Duração</TableHead></>)}
                    {cat === "server" && <TableHead>Custo/Crédito</TableHead>}
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum item global configurado</TableCell></TableRow>
                  ) : (
                    filtered.map((opt) => (
                      <TableRow key={opt.id}>
                        <TableCell className="font-medium">{opt.name}</TableCell>
                        {cat === "plan" && (<><TableCell className="font-mono">R$ {opt.config?.price || 0}</TableCell><TableCell className="font-mono">{opt.config?.credits || 0}</TableCell><TableCell className="font-mono">{opt.config?.screens || 1}</TableCell><TableCell className="hidden md:table-cell text-muted-foreground">{opt.config?.duration_months || 1} mês(es)</TableCell></>)}
                        {cat === "server" && (<TableCell className="font-mono">R$ {opt.config?.cost_per_credit || 0}</TableCell>)}
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(opt)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingId(opt.id); setDeleteOpen(true); }} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Criar"} {categoryLabels[tab]?.slice(0, -1)} Global</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome" />
            </div>
            {getConfigFields().map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input type={field.type} step={field.type === "number" ? "0.01" : undefined} value={formConfig[field.key] ?? ""} onChange={(e) => setFormConfig({ ...formConfig, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !formName.trim()}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item global</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Isso afetará todos os usuários que usam este padrão.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminServiceConfig;
