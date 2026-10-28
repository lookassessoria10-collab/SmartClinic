"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { signUp, type FormState } from "@/modules/auth/actions";
import { AuthShell, FormNotice, linkClass } from "@/modules/auth/components/auth-shell";
import { PASSWORD_MIN } from "@/modules/auth/schemas";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";
import { PasswordInput } from "@/ui/password-input";

export default function SignUpPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});

  if (state.ok) {
    return (
      <AuthShell title="Confirme seu e-mail">
        <div className="flex flex-col items-center text-center" role="status">
          <span className="grid size-14 place-items-center rounded-full bg-accent-subtle text-accent">
            <MailCheck className="size-7" aria-hidden />
          </span>
          <p className="mt-4 text-body">
            Enviamos um link para <strong className="font-semibold">{state.values?.email}</strong>.
          </p>
          <p className="mt-2 text-body-sm text-ink-2">
            Abra o e-mail e clique no link para ativar a conta e configurar sua clínica. Não chegou? Confira a caixa de spam.
          </p>
          <Link href="/login" className={`mt-6 ${linkClass}`}>
            Voltar para o login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Criar conta"
      description="Em poucos minutos sua clínica estará pronta para receber agendamentos."
      footer={
        <>
          Já tem conta?{" "}
          <Link href="/login" className={linkClass}>
            Entrar
          </Link>
        </>
      }
    >
      <form action={action} noValidate className="flex flex-col gap-4">
        {state.message && <FormNotice tone="danger">{state.message}</FormNotice>}
        <Field label="Seu nome completo" error={state.fields?.fullName}>
          <Input name="fullName" autoComplete="name" autoCapitalize="words" defaultValue={state.values?.fullName} />
        </Field>
        <Field label="E-mail" error={state.fields?.email}>
          <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} />
        </Field>
        <Field label="Senha" error={state.fields?.password} hint={`Pelo menos ${PASSWORD_MIN} caracteres. Uma frase curta é mais fácil de lembrar.`}>
          <PasswordInput name="password" autoComplete="new-password" />
        </Field>
        <p className="text-caption text-ink-2">
          Ao criar a conta, você concorda com os termos de uso e a política de privacidade (textos definitivos na Fase 10).
        </p>
        <Button type="submit" size="lg" loading={pending}>
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}
