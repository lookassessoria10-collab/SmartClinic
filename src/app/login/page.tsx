"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, FlaskConical } from "lucide-react";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Informe um e-mail válido.";
    if (password.length < 1) next.password = "Informe sua senha.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    // Protótipo: nenhuma credencial é verificada nem enviada a lugar algum.
    setTimeout(() => router.push("/c/clinica-aurora/inicio"), 400);
  }

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
          <h1 className="text-title-1 font-semibold">Entrar</h1>
          <p className="mt-1 text-body-sm text-ink-2">Acesse a agenda da sua clínica.</p>

          <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
            <Field label="E-mail" error={errors.email}>
              <Input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@clinica.com.br" />
            </Field>
            <div className="relative">
              <Field label="Senha" error={errors.password}>
                <Input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-11"
                />
              </Field>
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={show}
                  className="absolute top-[30px] right-1 grid size-9 place-items-center rounded-sm text-ink-3 hover:bg-muted hover:text-ink"
                >
                  {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
            </div>
            <div className="-mt-1 text-right">
              <span className="text-body-sm text-ink-3">Esqueci minha senha (Fase 3)</span>
            </div>
            <Button type="submit" size="lg" loading={loading}>
              Entrar
            </Button>
          </form>

          <div className="mt-6 border-t border-line pt-5 text-center text-body-sm text-ink-2">
            Ainda não usa?{" "}
            <Link href="/onboarding" className="font-medium text-accent underline-offset-2 hover:underline">
              Criar conta da clínica
            </Link>
          </div>
        </div>

        <div className="mt-6 flex gap-3 rounded-md border border-line bg-surface/70 p-4 text-body-sm text-ink-2">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <p>
            <strong className="font-medium text-ink">Protótipo.</strong> Qualquer e-mail e senha funcionam e nada é enviado. Não use dados reais.{" "}
            <Link href="/agendar/clinica-aurora" className="font-medium text-accent underline-offset-2 hover:underline">
              Ver página pública de agendamento
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
