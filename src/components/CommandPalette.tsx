import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate } from "@/lib/status";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, MessageSquare, Settings, FileText, Server,
  Search, UserPlus, Globe, Shield, Crown, Keyboard
} from "lucide-react";

interface CommandPaletteProps {
  onAddClient?: () => void;
  onClientSelect?: (client: Client) => void;
}

const PAGES = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, keywords: "dashboard inicio home" },
  { label: "Clientes", path: "/clients", icon: Users, keywords: "clientes lista" },
  { label: "Mensagens", path: "/messages", icon: MessageSquare, keywords: "mensagens whatsapp" },
  { label: "Relatórios", path: "/reports", icon: FileText, keywords: "relatorios pdf mensal" },
  { label: "Servidores & Planos", path: "/service-config", icon: Server, keywords: "servidores planos config" },
  { label: "Configurações", path: "/settings", icon: Settings, keywords: "configuracoes conta perfil" },
];

const ADMIN_PAGES = [
  { label: "Dashboard Global", path: "/admin", icon: Globe, keywords: "admin global dashboard" },
  { label: "Usuários (Todos)", path: "/admin/users", icon: Shield, keywords: "admin usuarios" },
  { label: "Log de Atividades", path: "/admin/audit", icon: Crown, keywords: "admin audit log" },
];

export function CommandPalette({ onAddClient, onClientSelect }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: clients } = useClients({ ownOnly: true });
  const { isSuperAdmin, roles } = useAuth();
  const isPanelAdmin = roles.some((r) => r.role === "panel_admin" && r.is_active);

  // Global keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isInputFocused())) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      // N for new client (only when not in input)
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !isInputFocused()) {
        e.preventDefault();
        onAddClient?.();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onAddClient]);

  const goTo = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
    },
    [navigate]
  );

  const selectClient = useCallback(
    (client: Client) => {
      onClientSelect?.(client);
      setOpen(false);
    },
    [onClientSelect]
  );

  // Build client items with status
  const clientItems = useMemo(() => {
    if (!clients) return [];
    return clients.slice(0, 50).map((c) => ({
      client: c,
      status: getStatusFromDate(c.expiration_date),
    }));
  }, [clients]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar clientes, páginas, ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => { onAddClient?.(); setOpen(false); }}>
            <UserPlus className="mr-2 h-4 w-4" />
            Novo Cliente
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              N
            </kbd>
          </CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>
            <Keyboard className="mr-2 h-4 w-4" />
            Atalhos de Teclado
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ?
            </kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Pages */}
        <CommandGroup heading="Páginas">
          {PAGES.map((page) => (
            <CommandItem key={page.path} onSelect={() => goTo(page.path)} keywords={[page.keywords]}>
              <page.icon className="mr-2 h-4 w-4" />
              {page.label}
            </CommandItem>
          ))}
          {(isSuperAdmin) && ADMIN_PAGES.map((page) => (
            <CommandItem key={page.path} onSelect={() => goTo(page.path)} keywords={[page.keywords]}>
              <page.icon className="mr-2 h-4 w-4" />
              {page.label}
            </CommandItem>
          ))}
          {(isPanelAdmin || isSuperAdmin) && (
            <CommandItem onSelect={() => goTo("/resellers")} keywords={["revendedores"]}>
              <Users className="mr-2 h-4 w-4" />
              Revendedores
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* Clients */}
        {clientItems.length > 0 && (
          <CommandGroup heading={`Clientes (${clients?.length || 0})`}>
            {clientItems.map(({ client, status }) => (
              <CommandItem
                key={client.id}
                onSelect={() => selectClient(client)}
                keywords={[client.phone || "", client.plan || "", client.servidor || ""]}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${status.bgClass}`} />
                  <span className="flex-1 truncate">{client.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{status.label}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
}
