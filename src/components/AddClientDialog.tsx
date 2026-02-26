import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyReseller } from "@/hooks/useResellers";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceOptions } from "@/hooks/useServiceOptions";
import { validateWhatsAppPhone } from "@/lib/phone";

export function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [plan, setPlan] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");
  const [valor, setValor] = useState("");
  const [servidor, setServidor] = useState("");
  const [telas, setTelas] = useState("1");
  const [aplicativo, setAplicativo] = useState("");
  const [dispositivo, setDispositivo] = useState("");
  const [captacao, setCaptacao] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const { user, roles } = useAuth();
  const { data: myReseller } = useMyReseller();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans } = useServiceOptions("plan");
  const { data: servers } = useServiceOptions("server");
  const { data: apps } = useServiceOptions("app");
  const { data: devices } = useServiceOptions("device");
  const { data: captacoes } = useServiceOptions("captacao");
  const { data: pagamentos } = useServiceOptions("pagamento");

  const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);
  

  const resetForm = () => {
    setName(""); setPhone(""); setPhoneError(""); setPlan(""); setExpirationDate("");
    setNotes(""); setValor(""); setServidor(""); setTelas("1"); setAplicativo("");
    setDispositivo(""); setCaptacao(""); setFormaPagamento("");
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (value.trim()) {
      const { valid, error } = validateWhatsAppPhone(value);
      setPhoneError(valid ? "" : error || "");
    } else {
      setPhoneError("");
    }
  };

  const handlePlanChange = (planName: string) => {
    setPlan(planName);
    const planOpt = plans?.find(p => p.name === planName);
    if (planOpt?.config) {
      if (planOpt.config.price) setValor(String(planOpt.config.price));
      if (planOpt.config.screens) setTelas(String(planOpt.config.screens));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (phone.trim()) {
      const { valid, error } = validateWhatsAppPhone(phone);
      if (!valid) {
        setPhoneError(error || "Número inválido");
        return;
      }
    }

    setLoading(true);
    try {
      const cleanedPhone = phone.trim() ? validateWhatsAppPhone(phone).cleaned : null;

      const insertData: any = {
        user_id: user.id,
        name,
        phone: cleanedPhone,
        plan: plan || null,
        expiration_date: expirationDate,
        notes: notes || null,
        valor: valor ? Number(valor) : 0,
        servidor: servidor || "",
        telas: telas ? Number(telas) : 1,
        aplicativo: aplicativo || "",
        dispositivo: dispositivo || "",
        captacao: captacao || "",
        forma_pagamento: formaPagamento || "",
      };

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
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Novo Cliente
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
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
              <div className="space-y-2 col-span-2">
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input id="phone" value={phone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="(DD) 9XXXX-XXXX" required />
                {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan">Plano</Label>
                <Select value={plan} onValueChange={handlePlanChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                  <SelectContent>
                    {plans?.map(p => (<SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
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
                <Select value={servidor} onValueChange={setServidor}>
                  <SelectTrigger><SelectValue placeholder="Selecione o servidor" /></SelectTrigger>
                  <SelectContent>
                    {servers?.map(s => (<SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telas">Telas</Label>
                <Input id="telas" type="number" value={telas} onChange={(e) => setTelas(e.target.value)} min="1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aplicativo">Aplicativo</Label>
                <Select value={aplicativo} onValueChange={setAplicativo}>
                  <SelectTrigger><SelectValue placeholder="Selecione o aplicativo" /></SelectTrigger>
                  <SelectContent>
                    {apps?.map(a => (<SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dispositivo">Dispositivo</Label>
                <Select value={dispositivo} onValueChange={setDispositivo}>
                  <SelectTrigger><SelectValue placeholder="Selecione o dispositivo" /></SelectTrigger>
                  <SelectContent>
                    {devices?.map(d => (<SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger><SelectValue placeholder="Selecione a forma" /></SelectTrigger>
                  <SelectContent>
                    {pagamentos?.map(p => (<SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="captacao">Captação</Label>
                <Select value={captacao} onValueChange={setCaptacao}>
                  <SelectTrigger><SelectValue placeholder="Selecione a captação" /></SelectTrigger>
                  <SelectContent>
                    {captacoes?.map(c => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais..." />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !!phoneError}>
              {loading ? "Salvando..." : "Adicionar Cliente"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
