import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Client } from "@/lib/supabase-types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceOptions } from "@/hooks/useServiceOptions";
import { validateWhatsAppPhone } from "@/lib/phone";
import { Save } from "lucide-react";

interface EditClientDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", plan: "", expiration_date: "", notes: "",
    valor: "", servidor: "", telas: "1", aplicativo: "", dispositivo: "", captacao: "", forma_pagamento: "",
    login: "", senha: "", pix: "",
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: plans } = useServiceOptions("plan");
  const { data: servers } = useServiceOptions("server");
  const { data: apps } = useServiceOptions("app");
  const { data: devices } = useServiceOptions("device");
  const { data: captacoes } = useServiceOptions("captacao");
  const { data: pagamentos } = useServiceOptions("pagamento");

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name || "", phone: client.phone || "", plan: client.plan || "",
        expiration_date: client.expiration_date || "", notes: client.notes || "",
        valor: client.valor ? String(client.valor) : "", servidor: client.servidor || "",
        telas: client.telas ? String(client.telas) : "1", aplicativo: client.aplicativo || "",
        dispositivo: client.dispositivo || "", captacao: client.captacao || "", forma_pagamento: (client as any).forma_pagamento || "",
        login: (client as any).login || "", senha: (client as any).senha || "", pix: (client as any).pix || "",
      });
      setPhoneError("");
    }
  }, [client]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhoneChange = (value: string) => {
    handleChange("phone", value);
    if (value.trim()) {
      const { valid, error } = validateWhatsAppPhone(value);
      setPhoneError(valid ? "" : error || "");
    } else {
      setPhoneError("");
    }
  };

  const handlePlanChange = (planName: string) => {
    handleChange("plan", planName);
    const planOpt = plans?.find(p => p.name === planName);
    if (planOpt?.config) {
      if (planOpt.config.price) handleChange("valor", String(planOpt.config.price));
      if (planOpt.config.screens) handleChange("telas", String(planOpt.config.screens));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !client) return;

    if (form.phone.trim()) {
      const { valid, error } = validateWhatsAppPhone(form.phone);
      if (!valid) { setPhoneError(error || "Número inválido"); return; }
    }

    setLoading(true);
    try {
      const cleanedPhone = form.phone.trim() ? validateWhatsAppPhone(form.phone).cleaned : null;
      const updateData: any = {
        name: form.name, phone: cleanedPhone, plan: form.plan,
        expiration_date: form.expiration_date, notes: form.notes || null,
        valor: form.valor ? Number(form.valor) : 0, servidor: form.servidor || "",
        telas: form.telas ? Number(form.telas) : 1, aplicativo: form.aplicativo || "",
        dispositivo: form.dispositivo || "", captacao: form.captacao || "", forma_pagamento: form.forma_pagamento || "",
        login: form.login || "", senha: form.senha || "", pix: form.pix || "",
      };

      const { error } = await supabase.from("clients").update(updateData).eq("id", client.id);
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
            <div className="space-y-2 col-span-2">
              <Label>WhatsApp</Label>
              <Input value={form.phone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="(DD) 9XXXX-XXXX" />
              {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={form.plan} onValueChange={handlePlanChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map(p => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select value={form.servidor} onValueChange={(v) => handleChange("servidor", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o servidor" />
                </SelectTrigger>
                <SelectContent>
                  {servers?.map(s => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Telas</Label>
              <Input type="number" value={form.telas} onChange={(e) => handleChange("telas", e.target.value)} min="1" />
            </div>
            <div className="space-y-2">
              <Label>Aplicativo</Label>
              <Select value={form.aplicativo} onValueChange={(v) => handleChange("aplicativo", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o aplicativo" />
                </SelectTrigger>
                <SelectContent>
                  {apps?.map(a => (
                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dispositivo</Label>
              <Select value={form.dispositivo} onValueChange={(v) => handleChange("dispositivo", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o dispositivo" />
                </SelectTrigger>
                <SelectContent>
                  {devices?.map(d => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={(v) => handleChange("forma_pagamento", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma" />
                </SelectTrigger>
                <SelectContent>
                  {pagamentos?.map(p => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Captação</Label>
              <Select value={form.captacao} onValueChange={(v) => handleChange("captacao", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a captação" />
                </SelectTrigger>
                <SelectContent>
                  {captacoes?.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Login / Usuário</Label>
              <Input value={form.login} onChange={(e) => handleChange("login", e.target.value)} placeholder="Login de acesso" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input value={form.senha} onChange={(e) => handleChange("senha", e.target.value)} placeholder="Senha de acesso" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Chave PIX (individual)</Label>
              <Input value={form.pix} onChange={(e) => handleChange("pix", e.target.value)} placeholder="PIX do cliente (opcional)" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} placeholder="Notas adicionais..." />
            </div>
          </div>
          <Button type="submit" className="w-full gap-2" disabled={loading || !!phoneError}>
            <Save className="h-4 w-4" />
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
