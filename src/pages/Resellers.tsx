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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Pause, Play, Search } from "lucide-react";

const Resellers = () => {
  const { user, roles, loading } = useAuth();
  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const tenantId = roles.find((r) => r.tenant_id && r.is_active)?.tenant_id;
  const { data: resellers, isLoading } = useResellers(tenantId);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [maxClients, setMaxClients] = useState(50);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!loading && !isPanelAdmin) return <Navigate to="/" replace />;

  const filtered = resellers?.filter((r) =>
    r.display_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleCreate = async () => {
    if (!displayName.trim() || !email.trim() || !user || !tenantId) return;
    setSaving(true);
    try {
      // Create the user account for the reseller via edge function or direct signup
      // For now, we create the reseller record. The user account should exist or be invited.
      // We'll use a simplified approach: create reseller with a placeholder user_id
      // In production, this would trigger an invitation flow.
      
      // For MVP: admin provides an existing user email, we look up their ID
      const { data: existingRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "reseller")
        .limit(1000);

      // Create the reseller record - owner_user_id will be set when user accepts invite
      // For now, use a simple approach: create user_role + reseller together
      const { error } = await supabase.from("resellers").insert({
        tenant_id: tenantId,
        owner_user_id: user.id, // placeholder, will be updated
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
        <Input placeholder="Buscar revendedores..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum revendedor encontrado</TableCell></TableRow>
            ) : (
              filtered.map((r) => (
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleStatus(r)}
                      title={r.status === "active" ? "Suspender" : "Reativar"}
                    >
                      {r.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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

export default Resellers;
