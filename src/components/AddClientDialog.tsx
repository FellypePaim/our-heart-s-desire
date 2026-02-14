import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyReseller } from "@/hooks/useResellers";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState("Básico");
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");
  const { user, roles } = useAuth();
  const { data: myReseller } = useMyReseller();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);
  const tenantId = roles.find((r) => r.tenant_id && r.is_active)?.tenant_id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const insertData: any = {
        user_id: user.id,
        name,
        phone: phone || null,
        plan,
        expiration_date: expirationDate,
        notes: notes || null,
      };

      // Auto-assign tenant and reseller for scoped users
      if (tenantId) insertData.tenant_id = tenantId;
      if (isReseller && myReseller) insertData.reseller_id = myReseller.id;

      const { error } = await supabase.from("clients").insert(insertData);

      if (error) throw error;

      toast({ title: "Cliente adicionado!", description: `${name} foi cadastrado com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setName("");
      setPhone("");
      setPlan("Básico");
      setExpirationDate("");
      setNotes("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nome do cliente" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan">Plano</Label>
            <Input id="plan" value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Ex: Premium, Básico" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiration">Data de Vencimento *</Label>
            <Input id="expiration" type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais..." />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Adicionar Cliente"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
