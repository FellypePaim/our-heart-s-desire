import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/hooks/useTheme";
import { AppSidebar } from "@/components/AppSidebar";
import { PlanExpiredGuard } from "@/components/PlanExpiredGuard";
import { Progress } from "@/components/ui/progress";
import { TrialWelcomeModal } from "@/components/TrialWelcomeModal";
import { AIChatWidget } from "@/components/AIChatWidget";

import { CommandPalette } from "@/components/CommandPalette";
import Index from "./pages/Index";
import Clients from "./pages/Clients";
import Resellers from "./pages/Resellers";
import Messages from "./pages/Messages";
import SettingsPage from "./pages/SettingsPage";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminServiceConfig from "./pages/admin/AdminServiceConfig";
import AdminPlans from "./pages/admin/AdminPlans";
import ServiceConfig from "./pages/ServiceConfig";
import Reports from "./pages/Reports";
import BillingRules from "./pages/BillingRules";
import PlanExpired from "./pages/PlanExpired";

const queryClient = new QueryClient();

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireRole({ roles: allowedRoles, children }: { roles: string[]; children: React.ReactNode }) {
  const { roles, loading } = useAuth();
  if (loading) return null;
  const hasRole = roles.some((r) => allowedRoles.includes(r.role) && r.is_active);
  if (!hasRole) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ProtectedLayout() {
  const { session, loading, user, roles } = useAuth();
  const [settingUp, setSettingUp] = useState(false);
  const [setupProgress, setSetupProgress] = useState(0);

  // On first login after email confirmation, setup role if missing
  useEffect(() => {
    // MUST wait for auth loading to finish before checking roles
    if (loading || !user) return;
    
    // If roles already loaded, clear any leftover guard
    if (roles.length > 0) {
      sessionStorage.removeItem(`self-register-${user.id}`);
      return;
    }

    // Prevent infinite reload loop - keep guard until roles load
    const alreadyCalled = sessionStorage.getItem(`self-register-${user.id}`);
    if (alreadyCalled) return;

    const selectedRole = user.user_metadata?.selected_role;
    if (selectedRole && (selectedRole === "panel_admin" || selectedRole === "reseller")) {
      setSettingUp(true);
      sessionStorage.setItem(`self-register-${user.id}`, "true");

      // Animate progress
      const interval = setInterval(() => {
        setSetupProgress((prev) => Math.min(prev + Math.random() * 15, 90));
      }, 400);

      supabase.functions.invoke("self-register", {
        body: { role: selectedRole },
      }).then(() => {
        clearInterval(interval);
        setSetupProgress(100);
        setTimeout(() => window.location.reload(), 600);
      }).catch((err) => {
        clearInterval(interval);
        console.error("Self-register error:", err);
        sessionStorage.removeItem(`self-register-${user.id}`);
        setSettingUp(false);
      });
    }
  }, [loading, user, roles]);

  if (loading || settingUp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 animate-fade-in max-w-sm text-center px-6">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              {settingUp ? "Preparando tudo para você..." : "Carregando..."}
            </h2>
            {settingUp && (
              <p className="text-sm text-muted-foreground">
                Estamos configurando seu painel. Isso levará apenas alguns segundos.
              </p>
            )}
          </div>
          {settingUp && (
            <div className="w-full space-y-2">
              <Progress value={setupProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">{Math.round(setupProgress)}%</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <PlanExpiredGuard>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-auto flex flex-col min-h-0">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/resellers" element={<RequireRole roles={["panel_admin", "super_admin"]}><Resellers /></RequireRole>} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/billing" element={<BillingRules />} />
              <Route path="/service-config" element={<ServiceConfig />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/admin" element={<RequireSuperAdmin><AdminDashboard /></RequireSuperAdmin>} />
              <Route path="/admin/users" element={<RequireSuperAdmin><AdminUsers /></RequireSuperAdmin>} />
              <Route path="/admin/settings" element={<RequireSuperAdmin><AdminSettings /></RequireSuperAdmin>} />
            <Route path="/admin/services" element={<RequireSuperAdmin><AdminServiceConfig /></RequireSuperAdmin>} />
            <Route path="/admin/plans" element={<RequireSuperAdmin><AdminPlans /></RequireSuperAdmin>} />
              <Route path="/admin/audit" element={<RequireSuperAdmin><AdminAudit /></RequireSuperAdmin>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
        
        <CommandPalette />
        <AIChatWidget />
        <TrialWelcomeModal />
      </div>
    </PlanExpiredGuard>
  );
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <Auth />;
}

function PlanExpiredRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/auth" replace />;
  return <PlanExpired />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/plan-expired" element={<PlanExpiredRoute />} />
              <Route path="/*" element={<ProtectedLayout />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
