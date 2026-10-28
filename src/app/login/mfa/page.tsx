"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { signOut } from "@/modules/auth/actions";
import { verifyLoginCode, type MfaState } from "@/modules/auth/mfa-actions";
import { AuthShell, FormNotice } from "@/modules/auth/components/auth-shell";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";

export default function MfaPage() {
  return (
    <Suspense>
      <MfaForm />
    </Suspense>
  );
}

function MfaForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<MfaState, FormData>(verifyLoginCode, {});

  return (
    <AuthShell
      title="Verificação em duas etapas"
      description="Abra o aplicativo autenticador no celular e digite o código de 6 números da sua conta."
      footer={
        <form action={signOut}>
          <button type="submit" className="font-medium text-accent underline-offset-2 hover:underline">
            Sair e entrar com outra conta
          </button>
        </form>
      }
    >
      <form action={action} noValidate className="flex flex-col gap-4">
        {state.message && <FormNotice tone="danger">{state.message}</FormNotice>}
        <input type="hidden" name="next" value={params.get("next") ?? ""} />
        <Field label="Código" error={state.field}>
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={7}
            autoFocus
            className="tabular text-center text-title-2 tracking-[0.3em]"
            placeholder="000000"
          />
        </Field>
        <Button type="submit" size="lg" loading={pending}>
          Confirmar
        </Button>
        <p className="text-caption text-ink-2">
          Perdeu o acesso ao aplicativo? Fale com o suporte da plataforma para verificar sua identidade e liberar a conta.
        </p>
      </form>
    </AuthShell>
  );
}
