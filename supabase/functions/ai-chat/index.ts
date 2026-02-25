import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o assistente de IPTV do Brave Gestor, uma plataforma de gestão de clientes IPTV.

ESCOPO PERMITIDO — responda APENAS sobre:
- Gestão de clientes IPTV (retenção, churn, cobrança, renovação)
- Estratégias de vendas e crescimento de base IPTV
- Dicas de uso do sistema Brave Gestor
- Servidores, aplicativos, planos e dispositivos IPTV
- Boas práticas de atendimento ao cliente IPTV
- Análise dos dados do PRÓPRIO usuário (fornecidos abaixo como contexto)

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

    // Create authenticated supabase client to fetch user's own data
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's clients (RLS will scope to their own data)
    const { data: clients } = await supabase
      .from("clients")
      .select("name, expiration_date, plan, servidor, aplicativo, valor, is_suspended, forma_pagamento, telas")
      .limit(500);

    // Build user context summary
    const totalClients = clients?.length ?? 0;
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const active = clients?.filter((c) => !c.is_suspended && c.expiration_date >= today).length ?? 0;
    const expired = clients?.filter((c) => c.expiration_date < today && !c.is_suspended).length ?? 0;
    const suspended = clients?.filter((c) => c.is_suspended).length ?? 0;
    const totalRevenue = clients?.reduce((sum, c) => sum + (c.valor ?? 0), 0) ?? 0;

    // Clients expiring in the next 3 days
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().split("T")[0];
    const expiringClients = clients
      ?.filter((c) => !c.is_suspended && c.expiration_date >= today && c.expiration_date <= in3DaysStr)
      .map((c) => `  • ${c.name} — vence ${c.expiration_date} (${c.plan ?? "sem plano"})`) ?? [];

    // Clients already expired (last 7 days)
    const minus7 = new Date(now);
    minus7.setDate(minus7.getDate() - 7);
    const minus7Str = minus7.toISOString().split("T")[0];
    const recentlyExpired = clients
      ?.filter((c) => !c.is_suspended && c.expiration_date < today && c.expiration_date >= minus7Str)
      .map((c) => `  • ${c.name} — venceu ${c.expiration_date}`) ?? [];

    // Revenue at risk (expiring soon)
    const revenueAtRisk = clients
      ?.filter((c) => !c.is_suspended && c.expiration_date >= today && c.expiration_date <= in3DaysStr)
      .reduce((sum, c) => sum + (c.valor ?? 0), 0) ?? 0;

    const userContext = `
DADOS DO USUÁRIO (somente dele):
- Total de clientes: ${totalClients}
- Ativos: ${active}
- Vencidos: ${expired}
- Suspensos: ${suspended}
- Receita mensal estimada: R$ ${totalRevenue.toFixed(2)}
- Receita em risco (vencendo em 3 dias): R$ ${revenueAtRisk.toFixed(2)}
${totalClients > 0 ? `- Planos: ${[...new Set(clients?.map((c) => c.plan).filter(Boolean))].join(", ")}` : ""}
${totalClients > 0 ? `- Servidores: ${[...new Set(clients?.map((c) => c.servidor).filter(Boolean))].join(", ")}` : ""}
${totalClients > 0 ? `- Apps: ${[...new Set(clients?.map((c) => c.aplicativo).filter(Boolean))].join(", ")}` : ""}
${expiringClients.length > 0 ? `\nCLIENTES VENCENDO NOS PRÓXIMOS 3 DIAS:\n${expiringClients.join("\n")}` : "\nNenhum cliente vencendo nos próximos 3 dias."}
${recentlyExpired.length > 0 ? `\nCLIENTES QUE VENCERAM NOS ÚLTIMOS 7 DIAS:\n${recentlyExpired.join("\n")}` : ""}`;

    const fullSystemPrompt = SYSTEM_PROMPT + "\n" + userContext;

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
