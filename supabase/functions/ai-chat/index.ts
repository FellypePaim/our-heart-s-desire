import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(role: string, userContext: string) {
  const baseRules = `Você é o assistente de IPTV do Brave Gestor, uma plataforma de gestão de clientes IPTV.

ESCOPO PERMITIDO — responda APENAS sobre:
- Gestão de clientes IPTV (retenção, churn, cobrança, renovação)
- Estratégias de vendas e crescimento de base IPTV
- Dicas de uso do sistema Brave Gestor
- Servidores, aplicativos, planos e dispositivos IPTV
- Boas práticas de atendimento ao cliente IPTV
- Análise dos dados fornecidos no contexto abaixo

PROIBIÇÕES ABSOLUTAS:
- NÃO responda sobre assuntos fora de IPTV e gestão de clientes
- NÃO gere imagens, código, poemas, histórias ou conteúdo criativo
- NÃO forneça dados de outros usuários do sistema
- NÃO invente números ou estatísticas — use apenas os dados do contexto
- NÃO ajude com pirataria, cracks ou atividades ilegais
- Se perguntarem algo fora do escopo, diga educadamente que só pode ajudar com assuntos relacionados a IPTV e gestão de clientes

Regras de formato:
- Responda sempre em português brasileiro
- Seja conciso e direto
- Use emojis moderadamente
- Foque em conselhos práticos e acionáveis`;

  let roleRules = "";

  if (role === "super_admin") {
    roleRules = `
SEU CARGO: SuperAdmin (acesso global ao sistema)
PERMISSÕES ESPECIAIS:
- Você tem visão completa da plataforma: todos os Masters, Revendedores e clientes do sistema
- Pode analisar métricas globais, comparar performance entre Masters e Revendedores
- Pode orientar sobre configurações globais, limites operacionais e governança
- Pode discutir dados de qualquer nível da hierarquia fornecidos no contexto`;
  } else if (role === "panel_admin") {
    roleRules = `
SEU CARGO: Master (administrador de painel)
PERMISSÕES:
- Você só pode ver e analisar dados dos SEUS clientes diretos e dos Revendedores que VOCÊ criou
- NÃO tem acesso a dados de outros Masters ou ao sistema global
- NÃO pode ver os clientes individuais dos seus Revendedores (sigilo de revenda)
- Pode orientar sobre gestão dos seus revendedores e seus próprios clientes
- Se perguntarem sobre dados globais, informe que essa visão é exclusiva do SuperAdmin
RESTRIÇÕES:
- Se perguntarem sobre outros Masters, clientes de revendedores ou métricas globais, recuse educadamente
- Diga: "Como Master, tenho acesso apenas aos seus clientes diretos e revendedores que você criou"`;
  } else if (role === "reseller") {
    roleRules = `
SEU CARGO: Revendedor
PERMISSÕES:
- Você só pode ver e analisar dados dos SEUS clientes diretos
- NÃO tem acesso a dados de outros Revendedores, Masters ou ao sistema global
- NÃO pode ver informações sobre o Master que o criou ou outros revendedores
- Pode receber dicas de gestão e retenção para a sua própria base de clientes
RESTRIÇÕES:
- Se perguntarem sobre revendedores, masters, dados globais ou usuários do sistema, recuse educadamente
- Diga: "Como Revendedor, tenho acesso apenas à sua base de clientes"
- NÃO discuta limites operacionais ou configurações administrativas`;
  } else {
    roleRules = `
SEU CARGO: Usuário básico
PERMISSÕES: Apenas dicas gerais sobre IPTV. Sem acesso a dados específicos.
RESTRIÇÕES: Recuse perguntas sobre dados do sistema, métricas ou administração.`;
  }

  return baseRules + roleRules + "\n" + userContext;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Authenticated client (RLS-scoped)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Service-role client for reading roles
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from token
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user roles
    const { data: rolesData } = await supabaseAdmin
      .from("user_roles")
      .select("role, is_active")
      .eq("user_id", user.id);

    const activeRoles = (rolesData || []).filter((r: any) => r.is_active).map((r: any) => r.role);
    const isSuperAdmin = activeRoles.includes("super_admin");
    const isPanelAdmin = activeRoles.includes("panel_admin");
    const isReseller = activeRoles.includes("reseller");

    const primaryRole = isSuperAdmin ? "super_admin" : isPanelAdmin ? "panel_admin" : isReseller ? "reseller" : "user";

    // Fetch clients (RLS already scopes)
    const { data: clients } = await supabase
      .from("clients")
      .select("name, expiration_date, plan, servidor, aplicativo, valor, is_suspended, forma_pagamento, telas")
      .limit(500);

    // Build context based on role
    const totalClients = clients?.length ?? 0;
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const active = clients?.filter((c: any) => !c.is_suspended && c.expiration_date >= today).length ?? 0;
    const expired = clients?.filter((c: any) => c.expiration_date < today && !c.is_suspended).length ?? 0;
    const suspended = clients?.filter((c: any) => c.is_suspended).length ?? 0;
    const totalRevenue = clients?.reduce((sum: number, c: any) => sum + (c.valor ?? 0), 0) ?? 0;

    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().split("T")[0];
    const expiringClients = clients
      ?.filter((c: any) => !c.is_suspended && c.expiration_date >= today && c.expiration_date <= in3DaysStr)
      .map((c: any) => `  • ${c.name} — vence ${c.expiration_date} (${c.plan ?? "sem plano"})`) ?? [];

    const minus7 = new Date(now);
    minus7.setDate(minus7.getDate() - 7);
    const minus7Str = minus7.toISOString().split("T")[0];
    const recentlyExpired = clients
      ?.filter((c: any) => !c.is_suspended && c.expiration_date < today && c.expiration_date >= minus7Str)
      .map((c: any) => `  • ${c.name} — venceu ${c.expiration_date}`) ?? [];

    const revenueAtRisk = clients
      ?.filter((c: any) => !c.is_suspended && c.expiration_date >= today && c.expiration_date <= in3DaysStr)
      .reduce((sum: number, c: any) => sum + (c.valor ?? 0), 0) ?? 0;

    let userContext = `
DADOS DO USUÁRIO (${primaryRole}):
- Total de clientes: ${totalClients}
- Ativos: ${active}
- Vencidos: ${expired}
- Suspensos: ${suspended}
- Receita mensal estimada: R$ ${totalRevenue.toFixed(2)}
- Receita em risco (vencendo em 3 dias): R$ ${revenueAtRisk.toFixed(2)}
${totalClients > 0 ? `- Planos: ${[...new Set(clients?.map((c: any) => c.plan).filter(Boolean))].join(", ")}` : ""}
${totalClients > 0 ? `- Servidores: ${[...new Set(clients?.map((c: any) => c.servidor).filter(Boolean))].join(", ")}` : ""}
${totalClients > 0 ? `- Apps: ${[...new Set(clients?.map((c: any) => c.aplicativo).filter(Boolean))].join(", ")}` : ""}
${expiringClients.length > 0 ? `\nCLIENTES VENCENDO NOS PRÓXIMOS 3 DIAS:\n${expiringClients.join("\n")}` : "\nNenhum cliente vencendo nos próximos 3 dias."}
${recentlyExpired.length > 0 ? `\nCLIENTES QUE VENCERAM NOS ÚLTIMOS 7 DIAS:\n${recentlyExpired.join("\n")}` : ""}`;

    // Role-specific extra data
    if (isPanelAdmin || isSuperAdmin) {
      // Fetch resellers (RLS-scoped for master, all for superadmin)
      const { data: resellers } = await supabase
        .from("resellers")
        .select("display_name, status, limits")
        .limit(100);

      if (resellers && resellers.length > 0) {
        const activeResellers = resellers.filter((r: any) => r.status === "active").length;
        userContext += `\n\nREVENDEDORES (${resellers.length} total, ${activeResellers} ativos):`;
        resellers.forEach((r: any) => {
          userContext += `\n  • ${r.display_name} — ${r.status} (limite: ${(r.limits as any)?.max_clients ?? "?"} clientes)`;
        });
      }
    }

    if (isSuperAdmin) {
      // Fetch global stats
      const { count: totalUsersCount } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true });

      const { count: totalAllClients } = await supabaseAdmin
        .from("clients")
        .select("*", { count: "exact", head: true });

      userContext += `\n\nESTATÍSTICAS GLOBAIS (somente SuperAdmin):
- Total de usuários no sistema: ${totalUsersCount ?? 0}
- Total de clientes no sistema inteiro: ${totalAllClients ?? 0}`;
    }

    const fullSystemPrompt = buildSystemPrompt(primaryRole, userContext);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: fullSystemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro ao conectar com a IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
