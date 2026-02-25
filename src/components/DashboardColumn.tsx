import { Client } from "@/lib/supabase-types";
import { StatusConfig } from "@/lib/status";
import { ClientCard } from "./ClientCard";
import { cn } from "@/lib/utils";

interface DashboardColumnProps {
  status: StatusConfig;
  clients: Client[];
  onClientClick?: (client: Client) => void;
  maskPhone?: (value: string | null | undefined, type: "phone") => string;
}

export function DashboardColumn({ status, clients, onClientClick, maskPhone }: DashboardColumnProps) {
  const Icon = status.icon;

  return (
    <div className="flex flex-col min-w-[300px] max-w-[340px]">
      <div className={cn(
        "flex items-center gap-2 rounded-t-xl border px-4 py-3 shadow-sm",
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
        "flex-1 space-y-3 rounded-b-xl border border-t-0 p-3 min-h-[200px] shadow-sm glass",
        status.borderClass
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
              maskPhone={maskPhone}
            />
          ))
        )}
      </div>
    </div >
  );
}
