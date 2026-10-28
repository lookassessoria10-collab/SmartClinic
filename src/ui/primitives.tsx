"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, children, as: Tag = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <Tag className={cn("rounded-md border border-line bg-surface shadow-xs", className)}>{children}</Tag>;
}

export function CardHeader({ title, description, action, icon: Icon }: { title: string; description?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-accent-subtle text-accent">
            <Icon className="size-[18px]" aria-hidden />
          </span>
        )}
        <div>
          <h2 className="text-headline font-semibold">{title}</h2>
          {description && <p className="text-body-sm text-ink-2">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-muted text-ink-3">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="text-headline font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-body-sm text-ink-2">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-muted motion-reduce:animate-none", className)} aria-hidden />;
}

export function Avatar({ name, color, size = "md" }: { name: string; color?: number; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold", size === "sm" ? "size-7 text-caption" : "size-9 text-body-sm")}
      style={
        color
          ? { background: `var(--agenda-${color}-bg)`, color: `var(--agenda-${color})` }
          : { background: "var(--color-bg-muted)", color: "var(--color-text-secondary)" }
      }
    >
      {initials}
    </span>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}

/** Controle segmentado (radiogroup). O item selecionado usa vidro (D-13). */
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-sm bg-muted p-0.5", className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
                onChange(next.value);
                (e.currentTarget.parentElement?.querySelector(`[data-v="${next.value}"]`) as HTMLElement | null)?.focus();
              }
            }}
            data-v={o.value}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "h-9 rounded-[7px] px-3 text-body-sm font-medium transition-colors duration-(--duration-fast)",
              selected ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-title-1 font-semibold">{title}</h1>
        {description && <p className="mt-1 text-body-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
