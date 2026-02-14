import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, MessageSquare, Settings, LogOut, Radar,
  Crown, Building2, Shield, Globe, Moon, Sun, Menu, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function AppSidebar() {
  const { signOut, user, isSuperAdmin, impersonating, roles } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);

  const panelItems = [
    { to: "/", label: "Radar", icon: LayoutDashboard },
    { to: "/clients", label: isReseller ? "Meus Clientes" : "Clientes", icon: Users },
    ...(isPanelAdmin ? [{ to: "/resellers", label: "Revendedores", icon: Users }] : []),
    { to: "/messages", label: "Mensagens", icon: MessageSquare },
    { to: "/settings", label: "Configurações", icon: Settings },
  ];

  const superAdminItems = [
    { to: "/admin", label: "Dashboard Global", icon: Globe },
    { to: "/admin/tenants", label: "Painéis", icon: Building2 },
    { to: "/admin/users", label: "Usuários (Todos)", icon: Shield },
    { to: "/admin/settings", label: "Config. Globais", icon: Settings },
    { to: "/admin/audit", label: "Auditoria", icon: Crown },
  ];

  const renderNavItem = (item: { to: string; label: string; icon: any }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.to;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-primary"
        )}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </NavLink>
    );
  };

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <Radar className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-sm text-sidebar-primary">IPTV Radar</h1>
          <p className="text-xs text-sidebar-foreground/60 truncate">
            {isSuperAdmin ? "SuperAdmin" : "Painel Operacional"}
          </p>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto lg:hidden text-sidebar-foreground/50 hover:text-sidebar-primary"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {impersonating && (
        <div className="mx-3 mt-3 rounded-lg border border-status-today/30 bg-status-today-bg p-2.5 text-xs">
          <p className="font-semibold text-status-today">⚠️ Modo Suporte</p>
          <p className="text-status-today/80 mt-0.5">Você está em modo suporte (SuperAdmin).</p>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {isSuperAdmin && (
          <>
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              SuperAdmin
            </p>
            {superAdminItems.map(renderNavItem)}
            <div className="my-3 border-t border-sidebar-border" />
          </>
        )}

        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
          Painel
        </p>
        {panelItems.map(renderNavItem)}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-primary transition-colors"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
        </button>
        <p className="truncate px-3 text-xs text-sidebar-foreground/50">
          {user?.email}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-primary"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden flex h-10 w-10 items-center justify-center rounded-lg border bg-card shadow-md"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground shrink-0 transition-transform z-50",
          "fixed lg:static",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
