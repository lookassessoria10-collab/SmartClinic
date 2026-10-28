"use client";

import { useActionState, useState, useTransition } from "react";
import { Building2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { acceptInvitation, requestInvitationLink, type ActionState } from "@/modules/team/actions";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import { PASSWORD_MIN } from "@/modules/auth/schemas";
import { ROLE_OPTIONS } from "@/modules/team/errors";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";
import { PasswordInput } from "@/ui/password-input";
import { fmt } from "@/lib/format";

interface Props {
  token: string;
  email: string;
  organizationName: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  needsPassword: boolean;
}

export function AcceptInvitationForm({ token, email, organizationName, role, invitedBy, expiresAt, needsPassword }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(acceptInvitation.bind(null, token), {});
  const roleInfo = ROLE_OPTIONS.find((r) => r.value === role);

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <dl className="flex flex-col gap-3 rounded-md bg-canvas p-4 text-body-sm">
        <Row icon={Building2} label="Clínica" value={organizationName} />
        <Row icon={ShieldCheck} label="Papel" value={roleInfo ? `${roleInfo.label} — ${roleInfo.description}` : role} />
        <Row icon={UserRound} label="Convite de" value={invitedBy} />
        <Row icon={Mail} label="Sua conta" value={email} />
      </dl>
      <p className="-mt-2 text-caption text-ink-2">Convite válido até {fmt(expiresAt, "dd/MM/yyyy 'às' HH:mm")}.</p>

      {state.message && <FormNotice tone="danger">{state.message}</FormNotice>}

      {needsPassword && (
        <>
          <p className="text-body-sm text-ink-2">Para concluir, diga seu nome e crie uma senha para as próximas vezes.</p>
          <Field label="Seu nome completo" error={state.fields?.fullName}>
            <Input name="fullName" autoComplete="name" autoCapitalize="words" defaultValue={state.values?.fullName} />
          </Field>
          <Field label="Crie uma senha" error={state.fields?.password} hint={`Pelo menos ${PASSWORD_MIN} caracteres.`}>
            <PasswordInput name="password" autoComplete="new-password" />
          </Field>
        </>
      )}

      <Button type="submit" size="lg" loading={pending}>
        Aceitar e entrar na clínica
      </Button>
    </form>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-2" aria-hidden />
      <div className="min-w-0">
        <dt className="text-caption text-ink-2">{label}</dt>
        <dd className="font-medium break-words">{value}</dd>
      </div>
    </div>
  );
}

export function RequestLinkButton({ token }: { token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        loading={pending}
        disabled={message !== null}
        onClick={() =>
          start(async () => {
            const r = await requestInvitationLink(token);
            setMessage(r.message ?? null);
          })
        }
      >
        Receber novo link por e-mail
      </Button>
      {message && <FormNotice tone="success">{message}</FormNotice>}
    </>
  );
}
