import { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { logAudit } from "@/lib/audit";
import { validateWhatsAppPhone } from "@/lib/phone";
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, Loader2 } from "lucide-react";

interface ParsedRow {
  name: string;
  phone: string;
  expiration_date: string;
  plan: string;
  valor: string;
  aplicativo: string;
  servidor: string;
  dispositivo: string;
  telas: string;
  captacao: string;
  forma_pagamento: string;
  errors: string[];
}

const TEMPLATE_COLUMNS = [
  "Nome", "Telefone", "Vencimento", "Plano", "Valor",
  "Aplicativo", "Servidor", "Dispositivo", "Telas", "Captação", "Forma de Pagamento",
];

const EXAMPLE_ROWS = [
  ["João Silva", "+5511999999999", "2025-06-15", "Premium", "30", "IPTV Smarters", "Servidor 1", "Smart TV", "2", "Indicação", "PIX"],
  ["Maria Santos", "+5521988888888", "2025-07-01", "Básico", "25", "Xtream", "Servidor 2", "Celular", "1", "Instagram", "Cartão"],
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ...EXAMPLE_ROWS]);

  // Set column widths
  ws["!cols"] = TEMPLATE_COLUMNS.map((h) => ({ wch: Math.max(h.length + 2, 18) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  XLSX.writeFile(wb, "modelo_importacao_clientes.xlsx");
}

function parseDate(raw: any): string {
  if (!raw) return "";
  // If it's a JS Date from xlsx
  if (raw instanceof Date) {
    return raw.toISOString().split("T")[0];
  }
  const str = String(raw).trim();
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // dd/mm/yyyy
  const dmyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  // mm/dd/yyyy
  const mdyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mdyMatch) {
    const month = parseInt(mdyMatch[1]);
    if (month > 12) return `${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}`;
  }
  return str;
}

function validateRow(row: ParsedRow): string[] {
  const errors: string[] = [];
  if (!row.name.trim()) errors.push("Nome obrigatório");
  if (row.phone && !validateWhatsAppPhone(row.phone)) errors.push("Telefone inválido (use +55...)");
  if (!row.expiration_date) {
    errors.push("Vencimento obrigatório");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.expiration_date)) {
    errors.push("Data inválida (use AAAA-MM-DD ou DD/MM/AAAA)");
  }
  if (row.valor && isNaN(Number(row.valor))) errors.push("Valor deve ser numérico");
  if (row.telas && isNaN(Number(row.telas))) errors.push("Telas deve ser numérico");
  return errors;
}

export function ImportClientsDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { validCount, errorCount } = useMemo(() => {
    const valid = rows.filter((r) => r.errors.length === 0).length;
    return { validCount: valid, errorCount: rows.length - valid };
  }, [rows]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any>(ws, { header: 1, defval: "" });

        // Skip header row
        const dataRows = jsonData.slice(1).filter((r: any[]) => r.some((c: any) => String(c).trim()));

        const parsed: ParsedRow[] = dataRows.map((r: any[]) => {
          const row: ParsedRow = {
            name: String(r[0] || "").trim(),
            phone: String(r[1] || "").trim(),
            expiration_date: parseDate(r[2]),
            plan: String(r[3] || "").trim(),
            valor: String(r[4] || "").trim(),
            aplicativo: String(r[5] || "").trim(),
            servidor: String(r[6] || "").trim(),
            dispositivo: String(r[7] || "").trim(),
            telas: String(r[8] || "").trim(),
            captacao: String(r[9] || "").trim(),
            forma_pagamento: String(r[10] || "").trim(),
            errors: [],
          };
          row.errors = validateRow(row);
          return row;
        });

        setRows(parsed);
      } catch {
        toast({ title: "Erro ao ler arquivo", description: "Verifique se o arquivo é um Excel válido.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!user) return;
    const validRows = rows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) return;

    setImporting(true);
    try {
      const insertData = validRows.map((r) => ({
        user_id: user.id,
        name: r.name,
        phone: r.phone || null,
        expiration_date: r.expiration_date,
        plan: r.plan || null,
        valor: r.valor ? Number(r.valor) : 0,
        aplicativo: r.aplicativo || null,
        servidor: r.servidor || null,
        dispositivo: r.dispositivo || null,
        telas: r.telas ? Number(r.telas) : 1,
        captacao: r.captacao || null,
        forma_pagamento: r.forma_pagamento || null,
      }));

      // Insert in batches of 50
      const BATCH = 50;
      let inserted = 0;
      for (let i = 0; i < insertData.length; i += BATCH) {
        const batch = insertData.slice(i, i + BATCH);
        const { error } = await supabase.from("clients").insert(batch);
        if (error) throw error;
        inserted += batch.length;
      }

      await logAudit(user.id, "clients_imported", "client", undefined, { count: inserted, file: fileName });
      toast({ title: "Importação concluída!", description: `${inserted} clientes importados com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setRows([]);
      setFileName("");
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setRows([]);
      setFileName("");
    }
    setOpen(isOpen);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-4 w-4" />
        Importar Excel
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Clientes via Excel
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: Download template + Upload */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />
              Baixar Modelo Excel
            </Button>

            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFile}
              />
              <Button variant="outline" className="gap-2 w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" />
                {fileName || "Selecionar arquivo preenchido"}
              </Button>
            </div>
          </div>

          {/* Step 2: Preview */}
          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {validCount} válidos
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errorCount} com erros
                  </Badge>
                )}
                <span className="text-muted-foreground">{rows.length} linhas no total</span>
              </div>

              <ScrollArea className="flex-1 max-h-[45vh] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => (
                      <TableRow key={idx} className={row.errors.length > 0 ? "bg-destructive/5" : ""}>
                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{row.name || "—"}</TableCell>
                        <TableCell className="text-sm">{row.phone || "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{row.expiration_date || "—"}</TableCell>
                        <TableCell>{row.plan || "—"}</TableCell>
                        <TableCell>{row.valor || "—"}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <div className="flex items-start gap-1">
                              <X className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                              <span className="text-xs text-destructive">{row.errors.join("; ")}</span>
                            </div>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setRows([]); setFileName(""); }}>
                  Limpar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={validCount === 0 || importing}
                  className="gap-2"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importing ? "Importando..." : `Importar ${validCount} clientes`}
                </Button>
              </div>
            </>
          )}

          {rows.length === 0 && (
            <div className="text-center py-8 text-muted-foreground space-y-2">
              <FileSpreadsheet className="h-12 w-12 mx-auto opacity-30" />
              <p className="text-sm">
                Baixe o modelo, preencha com seus clientes e faça upload aqui.
              </p>
              <p className="text-xs">Formatos aceitos: .xlsx, .xls, .csv</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}