import { differenceInDays, startOfDay } from "date-fns";
import { 
  CheckCircle, Clock, AlertTriangle, AlertCircle, XCircle, Bell, Timer,
  type LucideIcon 
} from "lucide-react";

export type StatusKey = 
  | "active" 
  | "pre3" 
  | "pre2" 
  | "pre1" 
  | "today" 
  | "post1" 
  | "post2" 
  | "expired";

export interface StatusConfig {
  key: StatusKey;
  label: string;
  description: string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  templateKey: string | null;
}

const STATUS_MAP: Record<StatusKey, Omit<StatusConfig, "key">> = {
  active: {
    label: "Ativo",
    description: "Assinatura ativa",
    icon: CheckCircle,
    colorClass: "text-status-active",
    bgClass: "bg-status-active-bg",
    borderClass: "border-status-active/30",
    templateKey: null,
  },
  pre3: {
    label: "Vence em 3 dias",
    description: "Lembrete suave enviado",
    icon: Bell,
    colorClass: "text-status-pre3",
    bgClass: "bg-status-pre3-bg",
    borderClass: "border-status-pre3/30",
    templateKey: "pre3_reminder",
  },
  pre2: {
    label: "Vence em 2 dias",
    description: "Atenção necessária",
    icon: Clock,
    colorClass: "text-status-pre2",
    bgClass: "bg-status-pre2-bg",
    borderClass: "border-status-pre2/30",
    templateKey: "pre2_reminder",
  },
  pre1: {
    label: "Vence amanhã",
    description: "Lembrete direto enviado",
    icon: Timer,
    colorClass: "text-status-pre1",
    bgClass: "bg-status-pre1-bg",
    borderClass: "border-status-pre1/30",
    templateKey: "pre1_reminder",
  },
  today: {
    label: "Vence hoje",
    description: "Urgência — ação imediata",
    icon: AlertTriangle,
    colorClass: "text-status-today",
    bgClass: "bg-status-today-bg",
    borderClass: "border-status-today/30",
    templateKey: "today_urgent",
  },
  post1: {
    label: "Venceu ontem",
    description: "Cobrança firme enviada",
    icon: AlertCircle,
    colorClass: "text-status-post1",
    bgClass: "bg-status-post1-bg",
    borderClass: "border-status-post1/30",
    templateKey: "post1_charge",
  },
  post2: {
    label: "Venceu há 2 dias",
    description: "Situação crítica",
    icon: AlertCircle,
    colorClass: "text-status-post2",
    bgClass: "bg-status-post2-bg",
    borderClass: "border-status-post2/30",
    templateKey: "post2_charge",
  },
  expired: {
    label: "Vencido",
    description: "Aviso final enviado",
    icon: XCircle,
    colorClass: "text-status-expired",
    bgClass: "bg-status-expired-bg",
    borderClass: "border-status-expired/30",
    templateKey: "expired_final",
  },
};

export function getStatusFromDate(expirationDate: string | Date): StatusConfig {
  const today = startOfDay(new Date());
  const expDate = startOfDay(new Date(expirationDate));
  const diff = differenceInDays(expDate, today);

  let key: StatusKey;
  if (diff > 3) key = "active";
  else if (diff === 3) key = "pre3";
  else if (diff === 2) key = "pre2";
  else if (diff === 1) key = "pre1";
  else if (diff === 0) key = "today";
  else if (diff === -1) key = "post1";
  else if (diff === -2) key = "post2";
  else key = "expired";

  return { key, ...STATUS_MAP[key] };
}

export function getAllStatuses(): StatusConfig[] {
  return (Object.keys(STATUS_MAP) as StatusKey[]).map((key) => ({
    key,
    ...STATUS_MAP[key],
  }));
}

// Priority columns for dashboard
export const DASHBOARD_COLUMNS: StatusKey[] = [
  "today",
  "pre1",
  "post1",
  "post2",
  "expired",
  "pre2",
  "pre3",
  "active",
];
