import { useState } from "react";
import { MessageSquare, Save, RotateCcw, Eye, Edit2, Variable } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAllStatuses } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useMessageTemplates,
  DEFAULT_TEMPLATES,
  TEMPLATE_VARIABLES,
  EXTRA_TEMPLATE_KEYS,
} from "@/hooks/useMessageTemplates";

interface TemplateEditorProps {
  statusKey: string;
  label: string;
  description: string;
  statusConfig?: ReturnType<typeof getAllStatuses>[number];
  getTemplate: (key: string) => string;
  saveTemplate: (key: string, text: string) => Promise<void>;
  resetTemplate: (key: string) => Promise<void>;
  isCustom: (key: string) => boolean;
}

function TemplateEditor({
  statusKey,
  label,
  description,
  statusConfig,
  getTemplate,
  saveTemplate,
  resetTemplate,
  isCustom,
}: TemplateEditorProps) {
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState("");

  const currentText = getTemplate(statusKey);
  const custom = isCustom(statusKey);

  const startEdit = () => {
    setDraft(currentText);
    setEditing(true);
    setPreview(false);
  };

  const handleSave = async () => {
    await saveTemplate(statusKey, draft);
    setEditing(false);
  };

  const handleReset = async () => {
    await resetTemplate(statusKey);
    setEditing(false);
  };

  const insertVariable = (variable: string) => {
    setDraft((prev) => prev + variable);
  };

  const previewText = (text: string) =>
    text
      .replace(/\{nome\}/g, "João Silva")
      .replace(/\{plano\}/g, "Premium")
      .replace(/\{vencimento\}/g, "17/02/2026");

  const borderClass = statusConfig?.borderClass ?? "border-border";

  return (
    <Card className={`border ${borderClass}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{label}</CardTitle>
          <div className="flex items-center gap-2">
            {custom && (
              <Badge variant="outline" className="text-xs">
                Personalizado
              </Badge>
            )}
            {statusConfig && <StatusBadge status={statusConfig} size="sm" />}
          </div>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Variable className="h-3.5 w-3.5" />
                    Variáveis
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="space-y-1">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => insertVariable(v.key)}
                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm transition-colors"
                      >
                        <span className="font-mono text-primary">{v.key}</span>
                        <span className="text-muted-foreground ml-2">— {v.label}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setPreview(!preview)}
              >
                <Eye className="h-3.5 w-3.5" />
                {preview ? "Editar" : "Pré-visualizar"}
              </Button>
            </div>

            {preview ? (
              <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                {previewText(draft)}
              </div>
            ) : (
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                placeholder="Digite o template da mensagem..."
                className="font-mono text-sm"
              />
            )}

            <div className="flex items-center gap-2 justify-end">
              {custom && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-destructive">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Resetar padrão
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                Salvar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap font-mono text-muted-foreground">
              {currentText || "Nenhum template configurado"}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
                <Edit2 className="h-3.5 w-3.5" />
                Editar template
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const Messages = () => {
  const allStatuses = getAllStatuses();
  const templateStatuses = allStatuses.filter((s) => s.templateKey);
  const { loading, getTemplate, saveTemplate, resetTemplate, isCustom } = useMessageTemplates();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando templates...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Mensagens Automáticas
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Templates de notificação vinculados a cada status. Use variáveis como{" "}
          <code className="text-primary font-mono">{"{nome}"}</code>,{" "}
          <code className="text-primary font-mono">{"{plano}"}</code>,{" "}
          <code className="text-primary font-mono">{"{vencimento}"}</code> para personalizar.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Templates por Status</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {templateStatuses.map((status) => (
            <TemplateEditor
              key={status.key}
              statusKey={status.templateKey!}
              label={status.label}
              description={status.description}
              statusConfig={status}
              getTemplate={getTemplate}
              saveTemplate={saveTemplate}
              resetTemplate={resetTemplate}
              isCustom={isCustom}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Templates Extras</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {EXTRA_TEMPLATE_KEYS.map((item) => (
            <TemplateEditor
              key={item.key}
              statusKey={item.key}
              label={item.label}
              description={item.description}
              getTemplate={getTemplate}
              saveTemplate={saveTemplate}
              resetTemplate={resetTemplate}
              isCustom={isCustom}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Messages;
