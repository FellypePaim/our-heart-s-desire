import { useState } from "react";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate } from "@/lib/status";
import { StatusBadge } from "./StatusBadge";
import { EditClientDialog } from "./EditClientDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Trash2, Pause, Play, Calendar, Phone, Package, Pencil, Monitor, Tv, Server, Users, DollarSign } from "lucide-react";

interface ClientDetailDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDetailDialog({ client, open, onOpenChange }: ClientDetailDialogProps) {
  const [renewDate, setRenewDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!client) return null;
  const status = getStatusFromDate(client.expiration_date);

  const handleRenew = async () => {
    if (!renewDate) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ expiration_date: renewDate, is_suspended: false })
        .eq("id", client.id);
      if (error) throw error;
      toast({ title: "Renovado!", description: `${client.name} renovado até ${renewDate}.` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSuspend = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ is_suspended: !client.is_suspended })
        .eq("id", client.id);
      if (error) throw error;
      toast({ title: client.is_suspended ? "Reativado!" : "Suspenso!", description: `${client.name} foi ${client.is_suspended ? "reativado" : "suspenso"}.` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${client.name}?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("clients").delete().eq("id", client.id);
      if (error) throw error;
      toast({ title: "Excluído!", description: `${client.name} foi removido.` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {client.name}
              {client.is_suspended && (
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Suspenso</span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <StatusBadge status={status} />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                {client.phone || "Sem telefone"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4 shrink-0" />
                {client.plan || "Sem plano"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4 shrink-0" />
                {client.valor ? `R$ ${Number(client.valor).toFixed(2).replace(".", ",")}` : "Sem valor"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Server className="h-4 w-4 shrink-0" />
                {client.servidor || "Sem servidor"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Tv className="h-4 w-4 shrink-0" />
                {client.telas ?? 1} tela(s)
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Monitor className="h-4 w-4 shrink-0" />
                {client.aplicativo || "Sem app"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Monitor className="h-4 w-4 shrink-0" />
                {client.dispositivo || "Sem dispositivo"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                {client.captacao || "Sem captação"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <Calendar className="h-4 w-4 shrink-0" />
                Vence: {format(new Date(client.expiration_date + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>
            </div>

            {client.notes && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{client.notes}</p>
            )}

            <div className="border-t pt-4 space-y-3">
              <Label className="font-semibold">Renovar Assinatura</Label>
              <div className="flex gap-2">
                <Input type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} />
                <Button onClick={handleRenew} disabled={!renewDate || loading} className="gap-1.5 shrink-0">
                  <RefreshCw className="h-4 w-4" />
                  Renovar
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setEditOpen(true); onOpenChange(false); }} className="flex-1 gap-1.5">
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" onClick={handleToggleSuspend} disabled={loading} className="flex-1 gap-1.5">
                {client.is_suspended ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {client.is_suspended ? "Reativar" : "Suspender"}
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={loading} className="gap-1.5">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditClientDialog
        client={client}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
