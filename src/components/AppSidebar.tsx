import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, MessageSquare, Settings, LogOut,
  Crown, Shield, Globe, Moon, Sun, Menu, X, Server, FileText, Search
} from "lucide-react";
import logoBrave from "@/assets/logo-brave.png";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function AppSidebar() {
  const { signOut, user, isSuperAdmin, roles } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);
  const isReseller = roles.some((r) => r.role === "reseller" && r.is_active);

  const resellerItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/clients", label: "Meus Clientes", icon: Users },
    { to: "/messages", label: "Mensagens", icon: MessageSquare },
    { to: "/reports", label: "Relatórios", icon: FileText },
    { to: "/service-config", label: "Servidores & Planos", icon: Server },
    { to: "/settings", label: "Configurações", icon: Settings },
  ];

  const masterItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/clients", label: "Clientes", icon: Users },
    { to: "/resellers", label: "Revendedores", icon: Users },
    { to: "/messages", label: "Mensagens", icon: MessageSquare },
    { to: "/reports", label: "Relatórios", icon: FileText },
    { to: "/service-config", label: "Servidores & Planos", icon: Server },
    { to: "/settings", label: "Configurações", icon: Settings },
  ];

  const superAdminItems = [
    { to: "/admin", label: "Dashboard Global", icon: Globe },
    { to: "/admin/users", label: "Usuários (Todos)", icon: Shield },
    { to: "/admin/services", label: "Serviços Globais", icon: Server },
    { to: "/admin/audit", label: "Log de Atividades", icon: Crown },
  ];

  const getPanelItems = () => {
    if (isReseller) return resellerItems;
    if (isPanelAdmin) return masterItems;
    return masterItems;
  };

  const panelItems = getPanelItems();

  const getRoleLabel = () => {
    if (isSuperAdmin) return "SuperAdmin";
    if (isPanelAdmin) return "Master";
    if (isReseller) return "Revendedor";
    return "Usuário";
  };

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
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary p-1">
          <img src={logoBrave} alt="Brave Gestor" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-sm text-sidebar-primary">Brave Gestor</h1>
          <p className="text-xs text-sidebar-foreground/60 truncate">
            {getRoleLabel()}
          </p>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto lg:hidden text-sidebar-foreground/50 hover:text-sidebar-primary"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Search trigger */}
      <button
        onClick={() => {
          setMobileOpen(false);
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
        }}
        className="mx-3 mb-2 flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-primary transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-sidebar-border bg-sidebar px-1.5 font-mono text-[10px] text-sidebar-foreground/40">
          ⌘K
        </kbd>
      </button>

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
          {isReseller ? "Revendedor" : isPanelAdmin ? "Master" : "Menu"}
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
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden flex h-10 w-10 items-center justify-center rounded-lg border bg-card shadow-md"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

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
