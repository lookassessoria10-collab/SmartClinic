"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { signIn, type FormState } from "@/modules/auth/actions";
import { AuthShell, FormNotice, linkClass } from "@/modules/auth/components/auth-shell";
import { AUTH_MESSAGES } from "@/modules/auth/messages";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";
import { PasswordInput } from "@/ui/password-input";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});

  // Avisos vindos de redirecionamentos (ex.: depois de sair ou de um link vencido).
  const flash =
    params.get("erro") === "link" ? { tone: "danger" as const, text: AUTH_MESSAGES.linkInvalid }
    : params.get("saiu") ? { tone: "info" as const, text: "Você saiu da sua conta." }
    : params.get("next") ? { tone: "info" as const, text: "Entre para continuar." }
    : null;

  return (
    <AuthShell
      title="Entrar"
      description="Acesse a agenda da sua clínica."
      footer={
        <>
          Ainda não usa?{" "}
          <Link href="/cadastro" className={linkClass}>
            Criar conta da clínica
          </Link>
        </>
      }
    >
      <form action={action} noValidate className="flex flex-col gap-4">
        {state.message ? <FormNotice tone="danger">{state.message}</FormNotice> : flash && <FormNotice tone={flash.tone}>{flash.text}</FormNotice>}
        <input type="hidden" name="next" value={params.get("next") ?? ""} />
        <Field label="E-mail" error={state.fields?.email}>
          <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} placeholder="voce@clinica.com.br" />
        </Field>
        <Field label="Senha" error={state.fields?.password}>
          <PasswordInput name="password" autoComplete="current-password" />
        </Field>
        <div className="-mt-1 text-right">
          <Link href="/redefinir-senha" className={`text-body-sm ${linkClass}`}>
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" size="lg" loading={pending}>
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}
