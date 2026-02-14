import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

const AdminSettings = () => {
  const { isSuperAdmin, loading } = useAuth();
  if (!loading && !isSuperAdmin) return <Navigate to="/" replace />;

  const settingsGroups = [
    {
      title: "Templates Padrão WhatsApp",
      desc: "Templates padrão aplicados a novos painéis",
      content: "Configure templates padrão para novos painéis aqui...",
    },
    {
      title: "Parâmetros de Envio",
      desc: "Intervalo mínimo entre mensagens, limites de taxa",
      content: "Defina intervalos mínimos e limites de taxa aqui...",
    },
    {
      title: "Timezone Padrão",
      desc: "Fuso horário padrão do sistema",
      content: "America/Sao_Paulo",
    },
    {
      title: "Limites Padrão para Novos Painéis",
      desc: "Valores padrão aplicados ao criar um novo painel",
      content: "Revendedores: 10 | Clientes: 100 | Mensagens/mês: 1000",
    },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 md:h-6 md:w-6" />
          Configurações Globais
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Regras e parâmetros globais do sistema
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsGroups.map((sg) => (
          <Card key={sg.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{sg.title}</CardTitle>
              <CardDescription>{sg.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground font-mono">
                {sg.content}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminSettings;
