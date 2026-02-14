import { Client } from "@/lib/supabase-types";
import { StatusConfig } from "@/lib/status";
import { ClientCard } from "./ClientCard";
import { cn } from "@/lib/utils";

interface DashboardColumnProps {
  status: StatusConfig;
  clients: Client[];
  onClientClick?: (client: Client) => void;
}

export function DashboardColumn({ status, clients, onClientClick }: DashboardColumnProps) {
  const Icon = status.icon;
  
  return (
    <div className="flex flex-col min-w-[300px] max-w-[340px]">
      <div className={cn(
        "flex items-center gap-2 rounded-t-lg border px-4 py-3",
        status.bgClass,
        status.borderClass
      )}>
        <Icon className={cn("h-4 w-4", status.colorClass)} />
        <h3 className={cn("font-semibold text-sm", status.colorClass)}>{status.label}</h3>
        <span className={cn(
          "ml-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
          status.bgClass,
          status.colorClass,
          "border",
          status.borderClass
        )}>
          {clients.length}
        </span>
      </div>
      <div className={cn(
        "flex-1 space-y-2 rounded-b-lg border border-t-0 p-2 min-h-[200px]",
        status.borderClass,
        "bg-card/50"
      )}>
        {clients.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Nenhum cliente
          </p>
        ) : (
          clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onClick={() => onClientClick?.(client)}
            />
          ))
        )}
      </div>
    </div>
  );
}
