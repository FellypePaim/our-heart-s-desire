import { Client } from "@/lib/supabase-types";
import { getStatusFromDate } from "@/lib/status";
import { StatusBadge } from "./StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, User, Calendar, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ClientCardProps {
  client: Client;
  onClick?: () => void;
}

export function ClientCard({ client, onClick }: ClientCardProps) {
  const status = getStatusFromDate(client.expiration_date);

  return (
    <Card
      className={cn(
        "cursor-pointer border transition-all hover:shadow-md",
        status.borderClass,
        client.is_suspended && "opacity-60"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", status.bgClass)}>
              <User className={cn("h-4 w-4", status.colorClass)} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{client.name}</p>
              {client.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {client.phone}
                </p>
              )}
            </div>
          </div>
        </div>
        <StatusBadge status={status} size="sm" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            {client.plan}
          </span>
          <span className="flex items-center gap-1 font-mono">
            <Calendar className="h-3 w-3" />
            {format(new Date(client.expiration_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
