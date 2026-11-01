import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { Wordmark } from "@/ui/brand";

/**
 * Moldura comum das telas de autenticação: fundo azul da marca (como a arte smartclin),
 * logotipo em branco e o formulário num cartão de vidro claro.
 */
export function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#062f5e] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_520px_at_30%_32%,rgb(140_203_242/0.85),transparent_62%),radial-gradient(900px_700px_at_85%_20%,rgb(14_107_184/0.9),transparent_65%),radial-gradient(800px_600px_at_10%_100%,rgb(14_107_184/0.8),transparent_60%),radial-gradient(600px_500px_at_95%_95%,rgb(3_30_64/0.9),transparent_60%)]"
      />
      <div className="relative w-full max-w-[420px] animate-[pop-in_var(--duration-slow)_var(--ease-standard)]">
        <div className="mb-8 flex flex-col items-center gap-2 text-white">
          <Wordmark className="text-[2.5rem] leading-none" />
          <p className="text-body-sm text-white/85">Gestão para clínicas</p>
        </div>
        {/* Sobre o fundo escuro, o vidro fica mais opaco: texto secundário mantém ≥ 4,5:1. */}
        <div className="glass-strong rounded-xl border p-6 [--glass-bg-strong:rgb(255_255_255/0.92)] sm:p-8">
          <h1 className="text-title-1 font-semibold">{title}</h1>
          {description && <p className="mt-1 text-body-sm text-ink-2">{description}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-line pt-5 text-center text-body-sm text-ink-2">{footer}</div>}
        </div>
      </div>
    </main>
  );
}

const tones = {
  danger: { icon: AlertCircle, className: "border-danger/30 bg-danger-subtle text-danger" },
  success: { icon: CheckCircle2, className: "border-success/30 bg-success-subtle text-success" },
  info: { icon: Info, className: "border-info/30 bg-info-subtle text-info" },
};

/** Aviso dentro do formulário. `role=alert` para erros, `status` para o resto. */
export function FormNotice({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  const t = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-2 rounded-sm border p-3 text-body-sm", t.className)}>
      <t.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export const linkClass = "font-medium text-accent underline-offset-2 hover:underline";
