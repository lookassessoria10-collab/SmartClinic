import { Ban, Check, CheckCircle2, Clock, TimerOff, UserX, XCircle, type LucideIcon } from "lucide-react";
import type { AppointmentStatus } from "@/prototype/types";
import { cn } from "@/lib/cn";

export const statusMeta: Record<AppointmentStatus, { label: string; icon: LucideIcon; className: string }> = {
  requested: { label: "Aguardando aprovação", icon: Clock, className: "bg-warning-subtle text-warning" },
  confirmed: { label: "Confirmado", icon: CheckCircle2, className: "bg-success-subtle text-success" },
  declined: { label: "Recusado", icon: XCircle, className: "bg-danger-subtle text-danger" },
  expired: { label: "Expirada", icon: TimerOff, className: "bg-muted text-ink-2" },
  cancelled: { label: "Cancelado", icon: Ban, className: "bg-muted text-ink-2" },
  no_show: { label: "Faltou", icon: UserX, className: "bg-danger-subtle text-danger" },
  completed: { label: "Concluído", icon: Check, className: "bg-muted text-ink-2" },
};

/** Status sempre com ícone + texto, nunca só cor. */
export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-xs px-2 text-caption font-medium whitespace-nowrap",
        meta.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-xs bg-muted px-2 text-caption font-medium text-ink-2", className)}>
      {children}
    </span>
  );
}
