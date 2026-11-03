import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Blocos das lâminas da apresentação pública (/apresentacao). Lâminas claras usam os tokens da
 * plataforma (mesma leitura do app); capas e aberturas de capítulo usam o azul-marinho da marca.
 */

export function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={cn("flex items-center gap-3 text-caption font-semibold tracking-[0.14em] uppercase", dark ? "text-[#8ccbf2]" : "text-accent")}>
      <span aria-hidden className={cn("h-px w-8", dark ? "bg-[#8ccbf2]" : "bg-accent")} />
      {children}
    </p>
  );
}

export function SlideTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("font-[family-name:var(--font-display)] text-[clamp(1.6rem,3.4vw,2.75rem)] leading-[1.08] font-semibold tracking-[-0.02em]", className)}>
      {children}
    </h2>
  );
}

/** Destaque de palavra no título (azul no claro, céu no escuro). */
export function Hl({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return <span className={dark ? "text-[#8ccbf2]" : "text-accent"}>{children}</span>;
}

export function Lead({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <p className={cn("max-w-prose text-[clamp(0.98rem,1.4vw,1.15rem)] leading-relaxed", dark ? "text-white/80" : "text-ink-2", className)}>{children}</p>;
}

/** Texto de um lado, ilustração do outro (empilha no celular). */
export function Split({ text, visual, reverse }: { text: ReactNode; visual: ReactNode; reverse?: boolean }) {
  return (
    <div className={cn("grid h-full items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12", reverse && "lg:[&>*:first-child]:order-2")}>
      <div className="flex flex-col gap-4">{text}</div>
      <div className="min-w-0">{visual}</div>
    </div>
  );
}

export function Bullets({ items, dark }: { items: ReactNode[]; dark?: boolean }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((it, i) => (
        <li key={i} className={cn("flex gap-3 text-body-sm leading-relaxed sm:text-body", dark ? "text-white/85" : "text-ink-2")}>
          <span aria-hidden className={cn("mt-2 size-1.5 shrink-0 rounded-full", dark ? "bg-[#8ccbf2]" : "bg-accent")} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function FeatureCard({ icon: Icon, title, children, tone = "light" }: { icon: LucideIcon; title: string; children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[22px] border p-4 sm:p-5",
        tone === "dark" ? "border-white/15 bg-white/[0.07] text-white" : "border-line bg-surface shadow-sm",
      )}
    >
      <span className={cn("grid size-10 place-items-center rounded-[12px]", tone === "dark" ? "bg-white/10 text-[#8ccbf2]" : "bg-accent-subtle text-accent")}>
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <div className={cn("text-body-sm leading-relaxed", tone === "dark" ? "text-white/75" : "text-ink-2")}>{children}</div>
    </div>
  );
}

export function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="rounded-[22px] border border-line bg-surface p-4 shadow-sm sm:p-5">
      <p className="tabular font-[family-name:var(--font-display)] text-[clamp(1.8rem,3.5vw,2.6rem)] leading-none font-semibold text-accent">{value}</p>
      <p className="mt-2 font-semibold">{label}</p>
      {hint && <p className="text-caption text-ink-2">{hint}</p>}
    </div>
  );
}

/** Passos numerados ligados por uma linha (fluxos). */
export function Steps({ steps, dark }: { steps: { title: string; text: ReactNode }[]; dark?: boolean }) {
  return (
    <ol className={cn("grid gap-3", steps.length > 3 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3")}>
      {steps.map((s, i) => (
        <li key={s.title} className={cn("relative flex flex-col gap-2 rounded-[22px] border p-4", dark ? "border-white/15 bg-white/[0.07]" : "border-line bg-surface shadow-sm")}>
          <span className={cn("tabular grid size-8 place-items-center rounded-full text-body-sm font-semibold", dark ? "bg-[#8ccbf2] text-[#062f5e]" : "bg-accent text-white")}>{i + 1}</span>
          <p className={cn("font-semibold", dark && "text-white")}>{s.title}</p>
          <div className={cn("text-body-sm leading-relaxed", dark ? "text-white/75" : "text-ink-2")}>{s.text}</div>
        </li>
      ))}
    </ol>
  );
}

/** Legenda obrigatória das telas de exemplo: nada aqui é dado real. */
export function Illustrative({ dark }: { dark?: boolean }) {
  return <p className={cn("mt-2 text-center text-caption", dark ? "text-white/60" : "text-ink-3")}>Exemplo ilustrativo · dados fictícios</p>;
}
