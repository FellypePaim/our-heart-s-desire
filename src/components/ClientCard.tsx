import { useState } from "react";
import { Client } from "@/lib/supabase-types";
import { getStatusFromDate } from "@/lib/status";
import { StatusBadge } from "./StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, User, Calendar, Package, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { WhatsAppMessageDialog } from "./WhatsAppMessageDialog";

interface ClientCardProps {
  client: Client;
  onClick?: () => void;
  maskPhone?: (value: string | null | undefined, type: "phone") => string;
}

export function ClientCard({ client, onClick, maskPhone }: ClientCardProps) {
  const status = getStatusFromDate(client.expiration_date);
  const displayPhone = maskPhone ? maskPhone(client.phone, "phone") : (client.phone || "");
  const [messageOpen, setMessageOpen] = useState(false);

  const handleSendMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!client.phone) return;
    setMessageOpen(true);
  };

  return (
    <>
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
                    {displayPhone}
                  </p>
                )}
              </div>
            </div>
            {client.phone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleSendMessage}
                title="Enviar mensagem via WhatsApp"
              >
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
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

      <WhatsAppMessageDialog
        client={client}
        open={messageOpen}
        onOpenChange={setMessageOpen}
      />
    </>
  );
}
