import { useMemo, useState, useRef, useEffect } from "react";
import { Bell, AlertTriangle, Timer, WifiOff, X } from "lucide-react";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate } from "@/lib/status";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface NotificationBellProps {
  clients: Client[];
  onClientClick?: (client: Client) => void;
}

interface WhatsAppNotification {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell({ clients, onClientClick }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Client expiration notifications
  const clientNotifications = useMemo(() => {
    if (!clients) return [];
    return clients
      .map((c) => ({ client: c, status: getStatusFromDate(c.expiration_date) }))
      .filter(({ status }) => status.key === "today" || status.key === "pre1")
      .sort((a, b) => (a.status.key === "today" ? -1 : 1));
  }, [clients]);

  // WhatsApp disconnect notifications
  const { data: whatsappNotifications = [] } = useQuery({
    queryKey: ["whatsapp_notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_notifications")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as WhatsAppNotification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Realtime subscription for instant notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("whatsapp-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp_notifications", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const markAsRead = async (id: string) => {
    await supabase.from("whatsapp_notifications").update({ is_read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["whatsapp_notifications", user?.id] });
  };

  const markAllAsRead = async () => {
    if (!user || whatsappNotifications.length === 0) return;
    const ids = whatsappNotifications.map((n) => n.id);
    await supabase.from("whatsapp_notifications").update({ is_read: true }).in("id", ids);
    queryClient.invalidateQueries({ queryKey: ["whatsapp_notifications", user.id] });
  };

  const totalCount = clientNotifications.length + whatsappNotifications.length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border bg-background hover:bg-muted transition-colors"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border bg-card shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h4 className="text-sm font-semibold">Notificações</h4>
            <div className="flex items-center gap-2">
              {whatsappNotifications.length > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:underline"
                >
                  Limpar alertas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {totalCount === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <>
                {/* WhatsApp disconnect alerts */}
                {whatsappNotifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0"
                  >
                    <div className="mt-0.5 rounded-full p-1.5 bg-destructive/10">
                      <WifiOff className="h-3.5 w-3.5 text-destructive" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">WhatsApp Desconectado</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {notif.message}
                      </p>
                    </div>
                  </button>
                ))}

                {/* Client expiration alerts */}
                {clientNotifications.map(({ client, status }) => (
                  <button
                    key={client.id}
                    onClick={() => {
                      onClientClick?.(client);
                      setOpen(false);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0"
                  >
                    <div className={cn("mt-0.5 rounded-full p-1.5", status.bgClass)}>
                      {status.key === "today" ? (
                        <AlertTriangle className={cn("h-3.5 w-3.5", status.colorClass)} />
                      ) : (
                        <Timer className={cn("h-3.5 w-3.5", status.colorClass)} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{client.name}</p>
                      <p className={cn("text-xs font-medium", status.colorClass)}>
                        {status.label}
                      </p>
                      {client.phone && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{client.phone}</p>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>

          {totalCount > 0 && (
            <div className="border-t px-4 py-2.5">
              <p className="text-xs text-muted-foreground text-center">
                {totalCount} notificação{totalCount !== 1 ? "ões" : ""} ativa{totalCount !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
