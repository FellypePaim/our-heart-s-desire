import { useState, useRef } from "react";
import { Client } from "@/lib/supabase-types";
import { useAuth } from "@/hooks/useAuth";
import { useMyReseller } from "@/hooks/useResellers";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getStatusFromDate } from "@/lib/status";

interface CSVImportExportProps {
  clients: Client[];
}

const CSV_HEADERS = [
  "nome", "whatsapp", "plano", "vencimento", "valor", "servidor",
  "telas", "aplicativo", "dispositivo", "captacao", "forma_pagamento", "observacoes"
];

const CLIENT_FIELD_MAP: Record<string, keyof Client | string> = {
  nome: "name",
  whatsapp: "phone",
  plano: "plan",
  vencimento: "expiration_date",
  valor: "valor",
  servidor: "servidor",
  telas: "telas",
  aplicativo: "aplicativo",
  dispositivo: "dispositivo",
  captacao: "captacao",
  forma_pagamento: "forma_pagamento",
  observacoes: "notes",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/[;,]/).map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j] || "";
    });
    rows.push(row);
  }
  return rows;
}

function parseDate(dateStr: string): string | null {
  // Try dd/mm/yyyy
  const brMatch = dateStr.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try yyyy-mm-dd
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return dateStr;
  return null;
}

export function CSVImportExport({ clients }: CSVImportExportProps) {
  const { user, roles } = useAuth();
  const { data: myReseller } = useMyReseller();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);

  const handleExport = () => {
    if (!clients.length) {
      toast({ title: "Nada para exportar", variant: "destructive" });
      return;
    }

    const header = CSV_HEADERS.join(";");
    const rows = clients.map((c) => {
      const status = getStatusFromDate(c.expiration_date);
      return [
        c.name,
        c.phone || "",
        c.plan || "",
        format(new Date(c.expiration_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }),
        c.valor || 0,
        c.servidor || "",
        c.telas || 1,
        c.aplicativo || "",
        c.dispositivo || "",
        c.captacao || "",
        c.forma_pagamento || "",
        c.notes || "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";");
    });

    const csv = "\uFEFF" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clientes_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "Exportado!", description: `${clients.length} clientes exportados.` });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      const errs: string[] = [];

      rows.forEach((row, i) => {
        if (!row.nome?.trim()) errs.push(`Linha ${i + 2}: Nome obrigatório`);
        if (!row.vencimento?.trim()) errs.push(`Linha ${i + 2}: Vencimento obrigatório`);
        else if (!parseDate(row.vencimento.trim())) errs.push(`Linha ${i + 2}: Data inválida "${row.vencimento}"`);
      });

      setPreview(rows);
      setErrors(errs);
      setImportOpen(true);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!user || errors.length > 0) return;
    setImporting(true);

    try {
      const inserts = preview
        .filter((row) => row.nome?.trim() && row.vencimento?.trim())
        .map((row) => {
          const parsed: any = {
            user_id: user.id,
            name: row.nome.trim(),
            expiration_date: parseDate(row.vencimento.trim()) || "",
            phone: row.whatsapp?.trim() || null,
            plan: row.plano?.trim() || null,
            valor: row.valor ? Number(row.valor.replace(",", ".")) : 0,
            servidor: row.servidor?.trim() || "",
            telas: row.telas ? Number(row.telas) : 1,
            aplicativo: row.aplicativo?.trim() || "",
            dispositivo: row.dispositivo?.trim() || "",
            captacao: row.captacao?.trim() || "",
            forma_pagamento: row.forma_pagamento?.trim() || "",
            notes: row.observacoes?.trim() || null,
          };
          if (isReseller && myReseller) parsed.reseller_id = myReseller.id;
          return parsed;
        });

      if (inserts.length === 0) {
        toast({ title: "Nenhum registro válido", variant: "destructive" });
        return;
      }

      // Insert in batches of 50
      let success = 0;
      for (let i = 0; i < inserts.length; i += 50) {
        const batch = inserts.slice(i, i + 50);
        const { error } = await supabase.from("clients").insert(batch);
        if (error) throw error;
        success += batch.length;
      }

      toast({ title: "Importado!", description: `${success} clientes importados com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setImportOpen(false);
      setPreview([]);
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csv = "\uFEFF" + CSV_HEADERS.join(";") + "\nJoão Silva;11999998888;Mensal;01/01/2025;30;Servidor 1;1;App1;TV Box;;Pix;";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_importacao.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileSelect} />

      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4" />
        Importar CSV
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
        <Download className="h-4 w-4" />
        Exportar CSV
      </Button>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Clientes via CSV
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{preview.length} registro(s) encontrados</Badge>
              {errors.length > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.length} erro(s)
                </Badge>
              ) : (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Pronto para importar
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="ml-auto text-xs">
                Baixar modelo CSV
              </Button>
            </div>

            {errors.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm space-y-1">
                {errors.slice(0, 10).map((err, i) => (
                  <p key={i} className="text-destructive">{err}</p>
                ))}
                {errors.length > 10 && <p className="text-muted-foreground">...e mais {errors.length - 10} erros</p>}
              </div>
            )}

            <ScrollArea className="flex-1 min-h-0 max-h-[400px] rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{row.nome || "-"}</TableCell>
                      <TableCell>{row.whatsapp || "-"}</TableCell>
                      <TableCell>{row.plano || "-"}</TableCell>
                      <TableCell className="font-mono">{row.vencimento || "-"}</TableCell>
                      <TableCell className="font-mono">{row.valor || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing || errors.length > 0 || preview.length === 0}>
              {importing ? "Importando..." : `Importar ${preview.length} clientes`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
