import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { AppSidebar } from "@/components/AppSidebar";
import { PlanExpiredGuard } from "@/components/PlanExpiredGuard";
import { AIChatWidget } from "@/components/AIChatWidget";
import { MobileBottomNav } from "@/components/MobileBottomNav";
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
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <PlanExpiredGuard>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-auto flex flex-col min-h-0 pb-14 lg:pb-0">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/resellers" element={<RequireRole roles={["panel_admin", "super_admin"]}><Resellers /></RequireRole>} />
              <Route path="/messages" element={<Messages />} />
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
        <MobileBottomNav />
        <CommandPalette />
        <AIChatWidget />
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
              <Route path="/*" element={<ProtectedLayout />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
