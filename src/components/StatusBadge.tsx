import { StatusConfig } from "@/lib/status";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: StatusConfig;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const Icon = status.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        status.bgClass,
        status.colorClass,
        status.borderClass,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {status.label}
    </span>
  );
}
