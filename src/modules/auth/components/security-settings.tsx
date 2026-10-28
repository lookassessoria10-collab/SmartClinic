"use client";

import { useState, useTransition } from "react";
import { KeyRound, ShieldCheck, ShieldOff, Smartphone, UserRound } from "lucide-react";
import { confirmMfaEnrollment, removeMfaFactor, startMfaEnrollment, type Enrollment } from "@/modules/auth/mfa-actions";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import { Card, CardHeader } from "@/ui/primitives";
import { Badge } from "@/ui/status-badge";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Field, Input } from "@/ui/field";
import { useToast } from "@/ui/toast";
import { fmt } from "@/lib/format";

interface Factor {
  id: string;
  name: string;
  createdAt: string;
}

export function SecuritySettings({ name, email, factors, recommended }: { name: string; email: string; factors: Factor[]; recommended: boolean }) {
  const enabled = factors.length > 0;
  return (
    <div className="grid max-w-2xl gap-4">
      <Card>
        <CardHeader title="Seus dados" icon={UserRound} />
        <dl className="grid gap-3 px-5 pb-5 text-body-sm sm:grid-cols-2">
          <div>
            <dt className="text-caption text-ink-2">Nome</dt>
            <dd className="font-medium">{name}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-2">E-mail</dt>
            <dd className="font-medium break-all">{email}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Verificação em duas etapas"
          description="Além da senha, um código do aplicativo autenticador do celular (Google Authenticator, Microsoft Authenticator, 1Password e outros)."
          icon={enabled ? ShieldCheck : ShieldOff}
          action={enabled ? <Badge className="bg-success-subtle text-success">Ativada</Badge> : <Badge>Desativada</Badge>}
        />
        <div className="flex flex-col gap-4 px-5 pb-5">
          {!enabled && recommended && (
            <FormNotice tone="info">Recomendado para gestores: protege os dados da clínica mesmo se sua senha vazar.</FormNotice>
          )}
          {enabled ? <FactorList factors={factors} /> : <Enroll />}
        </div>
      </Card>
    </div>
  );
}

function Enroll() {
  const toast = useToast();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!enrollment) {
    return (
      <Button
        className="self-start"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await startMfaEnrollment();
            if (r.enrollment) setEnrollment(r.enrollment);
            else toast({ message: r.message ?? "Não foi possível iniciar.", tone: "danger" });
          })
        }
      >
        <Smartphone className="size-4" aria-hidden /> Ativar verificação em duas etapas
      </Button>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await confirmMfaEnrollment(enrollment.factorId, code);
          if (r.ok) toast({ message: r.message ?? "Ativada.", tone: "success" });
          else setError(r.field ?? r.message ?? "Código incorreto.");
        });
      }}
    >
      <ol className="flex flex-col gap-4 text-body-sm">
        <li>
          <p className="font-medium">1. No aplicativo autenticador, adicione uma conta lendo o QR code:</p>
          {/* QR gerado pelo próprio Supabase (data URI de SVG). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qrCode} alt="QR code para configurar o aplicativo autenticador" className="mt-3 size-44 rounded-md border border-line bg-white p-2" />
          <details className="mt-3">
            <summary className="cursor-pointer text-accent">Não consegue ler o QR? Digite a chave</summary>
            <p className="mt-2 flex items-center gap-2">
              <KeyRound className="size-4 shrink-0 text-ink-2" aria-hidden />
              <code className="rounded-xs bg-canvas px-2 py-1 font-mono text-caption break-all select-all">{enrollment.secret}</code>
            </p>
          </details>
        </li>
        <li>
          <p className="mb-2 font-medium">2. Digite o código de 6 números que apareceu no aplicativo:</p>
          <Field label="Código" error={error ?? undefined}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              className="tabular max-w-48 text-center text-title-2 tracking-[0.3em]"
              placeholder="000000"
            />
          </Field>
        </li>
      </ol>
      <p className="text-caption text-ink-2">
        Guarde a chave em um lugar seguro (por exemplo, o gerenciador de senhas): se trocar de celular, ela permite configurar o aplicativo de novo.
      </p>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Confirmar e ativar
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEnrollment(null)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function FactorList({ factors }: { factors: Factor[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<Factor | null>(null);

  return (
    <>
      <ul className="divide-y divide-line rounded-md border border-line">
        {factors.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3 text-body-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Smartphone className="size-4 shrink-0 text-ink-2" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium">{f.name}</span>
                <span className="block text-caption text-ink-2">Ativado em {fmt(f.createdAt, "dd/MM/yyyy")}</span>
              </span>
            </span>
            <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-subtle hover:text-danger" disabled={pending} onClick={() => setConfirm(f)}>
              Remover
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title="Remover a verificação em duas etapas?"
        description="Sua conta volta a pedir só a senha. Se ela vazar, alguém poderá entrar e ver os dados da clínica."
        confirmLabel="Remover"
        onConfirm={() =>
          confirm &&
          start(async () => {
            const r = await removeMfaFactor(confirm.id);
            toast({ message: r.message ?? "", tone: r.ok ? "success" : "danger" });
          })
        }
      />
    </>
  );
}
