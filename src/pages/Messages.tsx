import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllStatuses } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";

const Messages = () => {
  const templateStatuses = getAllStatuses().filter((s) => s.templateKey);

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Mensagens Automáticas
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Templates de notificação vinculados a cada status
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {templateStatuses.map((status) => (
          <Card key={status.key} className={`border ${status.borderClass}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{status.label}</CardTitle>
                <StatusBadge status={status} size="sm" />
              </div>
              <CardDescription>{status.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground italic">
                Template de mensagem será configurado aqui...
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Extra templates */}
        {[
          { label: "Renovação Confirmada", desc: "Enviado automaticamente após renovação" },
          { label: "Teste Liberado", desc: "Enviado quando um teste é ativado" },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{item.label}</CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground italic">
                Template de mensagem será configurado aqui...
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Messages;
