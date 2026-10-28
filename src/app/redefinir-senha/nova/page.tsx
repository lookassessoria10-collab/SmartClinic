"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "@/modules/auth/actions";
import { AuthShell, FormNotice } from "@/modules/auth/components/auth-shell";
import { PASSWORD_MIN } from "@/modules/auth/schemas";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { PasswordInput } from "@/ui/password-input";

// Só acessível com a sessão aberta pelo link de redefinição (proxy.ts protege a rota).
export default function NewPasswordPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, {});

  return (
    <AuthShell title="Nova senha" description="Escolha uma senha nova. As outras sessões abertas da sua conta serão encerradas.">
      <form action={action} noValidate className="flex flex-col gap-4">
        {state.message && <FormNotice tone="danger">{state.message}</FormNotice>}
        <Field label="Nova senha" error={state.fields?.password} hint={`Pelo menos ${PASSWORD_MIN} caracteres.`}>
          <PasswordInput name="password" autoComplete="new-password" />
        </Field>
        <Field label="Repita a nova senha" error={state.fields?.confirm}>
          <PasswordInput name="confirm" autoComplete="new-password" />
        </Field>
        <Button type="submit" size="lg" loading={pending}>
          Salvar e entrar
        </Button>
      </form>
    </AuthShell>
  );
}
