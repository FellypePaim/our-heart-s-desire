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
  const [plan, setPlan] = useState("Mensal");
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");
  const [valor, setValor] = useState("");
  const [servidor, setServidor] = useState("");
  const [telas, setTelas] = useState("1");
  const [aplicativo, setAplicativo] = useState("");
  const [dispositivo, setDispositivo] = useState("");
  const [captacao, setCaptacao] = useState("");
  const { user, roles } = useAuth();
  const { data: myReseller } = useMyReseller();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);
  const tenantId = roles.find((r) => r.tenant_id && r.is_active)?.tenant_id;

  const resetForm = () => {
    setName("");
    setPhone("");
    setPlan("Mensal");
    setExpirationDate("");
    setNotes("");
    setValor("");
    setServidor("");
    setTelas("1");
    setAplicativo("");
    setDispositivo("");
    setCaptacao("");
  };

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
        valor: valor ? Number(valor) : 0,
        servidor: servidor || "",
        telas: telas ? Number(telas) : 1,
        aplicativo: aplicativo || "",
        dispositivo: dispositivo || "",
        captacao: captacao || "",
      };

      if (tenantId) insertData.tenant_id = tenantId;
      if (isReseller && myReseller) insertData.reseller_id = myReseller.id;

      const { error } = await supabase.from("clients").insert(insertData);
      if (error) throw error;

      toast({ title: "Cliente adicionado!", description: `${name} foi cadastrado com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["all_clients"] });
      setOpen(false);
      resetForm();
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nome do cliente" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plano</Label>
              <Input id="plan" value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Mensal, Trimestral..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiration">Vencimento *</Label>
              <Input id="expiration" type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input id="valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="servidor">Servidor</Label>
              <Input id="servidor" value={servidor} onChange={(e) => setServidor(e.target.value)} placeholder="Ex: BRAVE" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telas">Telas</Label>
              <Input id="telas" type="number" value={telas} onChange={(e) => setTelas(e.target.value)} min="1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aplicativo">Aplicativo</Label>
              <Input id="aplicativo" value={aplicativo} onChange={(e) => setAplicativo(e.target.value)} placeholder="Ex: XCIPTV" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dispositivo">Dispositivo</Label>
              <Input id="dispositivo" value={dispositivo} onChange={(e) => setDispositivo(e.target.value)} placeholder="Ex: Smart TV" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="captacao">Captação</Label>
              <Input id="captacao" value={captacao} onChange={(e) => setCaptacao(e.target.value)} placeholder="Ex: Divulgação, Indicação" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais..." />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Adicionar Cliente"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
