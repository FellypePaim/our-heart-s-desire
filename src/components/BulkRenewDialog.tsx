import { useState } from "react";
import { Client } from "@/lib/supabase-types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getStatusFromDate } from "@/lib/status";
import { StatusBadge } from "./StatusBadge";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Search, CalendarDays } from "lucide-react";

interface BulkRenewDialogProps {
  clients: Client[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RenewMode = "add_months" | "fixed_date";

export function BulkRenewDialog({ clients, open, onOpenChange }: BulkRenewDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [renewMode, setRenewMode] = useState<RenewMode>("add_months");
  const [months, setMonths] = useState(1);
  const [fixedDate, setFixedDate] = useState("");
  const [processing, setProcessing] = useState(false);

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone?.includes(q) || (c.plan || "").toLowerCase().includes(q);
  });

  const toggleClient = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleRenew = async () => {
    if (!user || selected.size === 0) return;
    setProcessing(true);

    try {
      const selectedClients = clients.filter((c) => selected.has(c.id));
      let successCount = 0;

      for (const client of selectedClients) {
        let newDate: string;
        if (renewMode === "add_months") {
          const current = new Date(client.expiration_date + "T12:00:00");
          const renewed = addMonths(current, months);
          newDate = renewed.toISOString().split("T")[0];
        } else {
          newDate = fixedDate;
        }

        const { error } = await supabase
          .from("clients")
          .update({ expiration_date: newDate })
          .eq("id", client.id);

        if (!error) {
          await logAudit(user.id, "client_renewed", "client", client.id, {
            old_date: client.expiration_date,
            new_date: newDate,
            bulk: true,
          });
          successCount++;
        }
      }

      toast({
        title: "Renovação em lote concluída!",
        description: `${successCount} de ${selected.size} clientes renovados com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setSelected(new Set());
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const canRenew = selected.size > 0 && (renewMode === "add_months" ? months > 0 : !!fixedDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Renovação em Lote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Renew config */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg border bg-muted/30">
            <div className="space-y-2">
              <Label>Modo de renovação</Label>
              <Select value={renewMode} onValueChange={(v: RenewMode) => setRenewMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add_months">Adicionar meses</SelectItem>
                  <SelectItem value="fixed_date">Data fixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {renewMode === "add_months" ? (
              <div className="space-y-2">
                <Label>Meses a adicionar</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Nova data de vencimento</Label>
                <Input
                  type="date"
                  value={fixedDate}
                  onChange={(e) => setFixedDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Search + select all */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selected.size === filtered.length ? "Desmarcar todos" : "Selecionar todos"}
            </Button>
          </div>

          <Badge variant="secondary" className="w-fit">
            {selected.size} selecionado(s)
          </Badge>

          {/* Client list */}
          <ScrollArea className="flex-1 min-h-0 max-h-[350px] rounded-lg border">
            <div className="divide-y">
              {filtered.map((client) => {
                const status = getStatusFromDate(client.expiration_date);
                const isSelected = selected.has(client.id);
                return (
                  <label
                    key={client.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleClient(client.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.plan || "Sem plano"} • Vence:{" "}
                        {format(new Date(client.expiration_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <StatusBadge status={status} size="sm" />
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum cliente encontrado
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleRenew}
            disabled={!canRenew || processing}
            className="gap-2"
          >
            <CalendarDays className="h-4 w-4" />
            {processing
              ? "Renovando..."
              : `Renovar ${selected.size} cliente(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
