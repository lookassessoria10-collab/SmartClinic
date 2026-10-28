import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/cn";

/** Moldura comum das telas de autenticação: marca + cartão + rodapé. */
export function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(900px_500px_at_15%_-10%,var(--color-accent-subtle),transparent_60%),radial-gradient(700px_500px_at_110%_110%,var(--agenda-2-bg),transparent_60%)] px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-md bg-accent text-title-2 font-semibold text-on-accent" aria-hidden>
            ◐
          </span>
          <div>
            <p className="text-headline font-semibold">Gestão para clínicas</p>
            <p className="text-body-sm text-ink-2">Nome provisório (D-01)</p>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-6 shadow-md sm:p-8">
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
