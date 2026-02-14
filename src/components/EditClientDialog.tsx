import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";

interface EditClientDialogProps {
  client: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    plan: "",
    expiration_date: "",
    notes: "",
    valor: "",
    servidor: "",
    telas: "1",
    aplicativo: "",
    dispositivo: "",
    captacao: "",
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name || "",
        phone: client.phone || "",
        plan: client.plan || "",
        expiration_date: client.expiration_date || "",
        notes: client.notes || "",
        valor: client.valor ? String(client.valor) : "",
        servidor: client.servidor || "",
        telas: client.telas ? String(client.telas) : "1",
        aplicativo: client.aplicativo || "",
        dispositivo: client.dispositivo || "",
        captacao: client.captacao || "",
      });
    }
  }, [client]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !client) return;
    setLoading(true);

    try {
      const updateData: any = {
        name: form.name,
        phone: form.phone || null,
        plan: form.plan,
        expiration_date: form.expiration_date,
        notes: form.notes || null,
        valor: form.valor ? Number(form.valor) : 0,
        servidor: form.servidor || "",
        telas: form.telas ? Number(form.telas) : 1,
        aplicativo: form.aplicativo || "",
        dispositivo: form.dispositivo || "",
        captacao: form.captacao || "",
      };

      const { error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", client.id);

      if (error) throw error;

      await logAudit(user.id, "client_updated", "client", client.id, { changes: updateData });
      toast({ title: "Salvo!", description: `${form.name} atualizado com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["all_clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => handleChange("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Input value={form.plan} onChange={(e) => handleChange("plan", e.target.value)} placeholder="Mensal, Trimestral..." />
            </div>
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input type="date" value={form.expiration_date} onChange={(e) => handleChange("expiration_date", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => handleChange("valor", e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Servidor</Label>
              <Input value={form.servidor} onChange={(e) => handleChange("servidor", e.target.value)} placeholder="Ex: BRAVE" />
            </div>
            <div className="space-y-2">
              <Label>Telas</Label>
              <Input type="number" value={form.telas} onChange={(e) => handleChange("telas", e.target.value)} min="1" />
            </div>
            <div className="space-y-2">
              <Label>Aplicativo</Label>
              <Input value={form.aplicativo} onChange={(e) => handleChange("aplicativo", e.target.value)} placeholder="Ex: XCIPTV" />
            </div>
            <div className="space-y-2">
              <Label>Dispositivo</Label>
              <Input value={form.dispositivo} onChange={(e) => handleChange("dispositivo", e.target.value)} placeholder="Ex: Smart TV" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Captação</Label>
              <Input value={form.captacao} onChange={(e) => handleChange("captacao", e.target.value)} placeholder="Ex: Divulgação, Indicação" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} placeholder="Notas adicionais..." />
            </div>
          </div>
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <Save className="h-4 w-4" />
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
