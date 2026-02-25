import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Radar, Eye, EyeOff, Mail, Lock, ArrowRight, UserPlus, LogIn, KeyRound } from "lucide-react";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        toast({
          title: "E-mail enviado!",
          description: "Verifique sua caixa de entrada para redefinir sua senha.",
        });
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Verifique seu e-mail para confirmar o cadastro.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar text-sidebar-foreground flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full border border-sidebar-foreground/20" />
          <div className="absolute bottom-32 right-16 w-96 h-96 rounded-full border border-sidebar-foreground/20" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full border border-sidebar-foreground/20" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
              <Radar className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight text-sidebar-primary">Brave Gestor</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-sidebar-primary">
            Controle total dos seus clientes
          </h1>
          <p className="text-lg text-sidebar-foreground/70 max-w-md">
            Gerencie clientes, monitore vencimentos e automatize cobranças em uma única plataforma inteligente.
          </p>
          <div className="flex gap-8 pt-4">
            {[
              { value: "99.9%", label: "Uptime" },
              { value: "10k+", label: "Clientes" },
              { value: "24/7", label: "Monitoramento" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold font-mono text-sidebar-primary">{stat.value}</div>
                <div className="text-sm text-sidebar-foreground/50">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sm text-sidebar-foreground/40">
          © {new Date().getFullYear()} Brave Gestor. Todos os direitos reservados.
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">

        {/* Abstract background blur orbs */}
        <div className="absolute top-1/4 -right-32 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-60 pointer-events-none" />
        <div className="absolute -bottom-32 left-1/4 w-[500px] h-[500px] bg-secondary/30 rounded-full blur-[120px] opacity-60 pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm space-y-8 p-8 glass rounded-2xl shadow-xl">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary">
              <Radar className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">Brave Gestor</span>
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "login" && "Bem-vindo de volta"}
              {mode === "signup" && "Crie sua conta"}
              {mode === "forgot" && "Recuperar senha"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login" && "Acesse seu painel operacional"}
              {mode === "signup" && "Preencha os dados para começar"}
              {mode === "forgot" && "Enviaremos um link para seu e-mail"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 pr-10 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full h-11 gap-2 font-semibold" disabled={loading}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : mode === "login" ? (
                <>
                  <LogIn className="h-4 w-4" />
                  Entrar
                </>
              ) : mode === "signup" ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  Criar conta
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Enviar link
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">
                {mode === "login" ? "Novo por aqui?" : "Já tem conta?"}
              </span>
            </div>
          </div>

          {/* Switch mode */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 gap-2"
            onClick={() => setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")}
          >
            {mode === "login" ? (
              <>
                Criar conta
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                Fazer login
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
