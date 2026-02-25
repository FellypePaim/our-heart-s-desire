import { useMemo, useState, useRef, useEffect } from "react";
import { Bell, AlertTriangle, Timer, X } from "lucide-react";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate } from "@/lib/status";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  clients: Client[];
  onClientClick?: (client: Client) => void;
}

export function NotificationBell({ clients, onClientClick }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const notifications = useMemo(() => {
    if (!clients) return [];
    return clients
      .map((c) => ({ client: c, status: getStatusFromDate(c.expiration_date) }))
      .filter(({ status }) => status.key === "today" || status.key === "pre1")
      .sort((a, b) => (a.status.key === "today" ? -1 : 1));
  }, [clients]);

  const count = notifications.length;

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
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border bg-card shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h4 className="text-sm font-semibold">Notificações</h4>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {count === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map(({ client, status }) => (
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
              ))
            )}
          </div>

          {count > 0 && (
            <div className="border-t px-4 py-2.5">
              <p className="text-xs text-muted-foreground text-center">
                {count} cliente{count !== 1 ? "s" : ""} precisando de atenção
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
