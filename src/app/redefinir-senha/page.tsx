"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/modules/auth/actions";
import { AuthShell, FormNotice, linkClass } from "@/modules/auth/components/auth-shell";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";

export default function ResetRequestPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});

  return (
    <AuthShell
      title="Redefinir senha"
      description="Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha."
      footer={
        <Link href="/login" className={linkClass}>
          Voltar para o login
        </Link>
      }
    >
      {state.ok ? (
        // Mesma mensagem exista ou não a conta (não revela cadastro).
        <FormNotice tone="success">
          Se houver uma conta para <strong className="font-semibold">{state.values?.email}</strong>, você receberá um link em instantes. O link vale por 1 hora.
        </FormNotice>
      ) : (
        <form action={action} noValidate className="flex flex-col gap-4">
          {state.message && <FormNotice tone="danger">{state.message}</FormNotice>}
          <Field label="E-mail" error={state.fields?.email}>
            <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} />
          </Field>
          <Button type="submit" size="lg" loading={pending}>
            Enviar link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
