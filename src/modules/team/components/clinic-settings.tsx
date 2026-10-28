"use client";

import { useActionState, useState } from "react";
import { Building2, Link2 } from "lucide-react";
import { changeClinicSlug, updateClinic, type ActionState } from "@/modules/team/actions";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import { slugProblem } from "@/modules/organizations/schemas";
import { Card, CardHeader, PageHeader } from "@/ui/primitives";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Field, Input } from "@/ui/field";

interface Clinic {
  name: string;
  slug: string;
  phone: string | null;
  timezone: string;
}

export function ClinicSettings({ slug, writable, clinic, slugJustChanged }: { slug: string; writable: boolean; clinic: Clinic; slugJustChanged: boolean }) {
  return (
    <>
      <PageHeader title="Clínica" description="Dados que aparecem para a equipe e na página de agendamento." />
      {!writable && (
        <div className="mb-4">
          <FormNotice tone="info">A clínica está em modo somente leitura: os dados não podem ser alterados.</FormNotice>
        </div>
      )}
      <div className="grid max-w-2xl gap-4">
        <DetailsForm slug={slug} writable={writable} clinic={clinic} />
        <SlugForm slug={slug} writable={writable} current={clinic.slug} justChanged={slugJustChanged} />
        <p className="text-caption text-ink-2">Fuso horário: {clinic.timezone} (alteração disponível com as unidades, em fase futura).</p>
      </div>
    </>
  );
}

function DetailsForm({ slug, writable, clinic }: { slug: string; writable: boolean; clinic: Clinic }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateClinic.bind(null, slug), {});
  return (
    <Card>
      <CardHeader title="Dados da clínica" icon={Building2} />
      <form action={action} noValidate className="flex flex-col gap-4 px-5 pb-5">
        {state.message && <FormNotice tone={state.ok ? "success" : "danger"}>{state.message}</FormNotice>}
        <Field label="Nome" error={state.fields?.name}>
          <Input name="name" defaultValue={state.values?.name ?? clinic.name} disabled={!writable} autoComplete="organization" />
        </Field>
        <Field label="Telefone" optional error={state.fields?.phone} hint="Aparece na página de agendamento para o paciente ligar.">
          <Input name="phone" type="tel" inputMode="tel" defaultValue={state.values?.phone ?? clinic.phone ?? ""} disabled={!writable} />
        </Field>
        <Button type="submit" loading={pending} disabled={!writable} className="self-start">
          Salvar
        </Button>
      </form>
    </Card>
  );
}

function SlugForm({ slug, writable, current, justChanged }: { slug: string; writable: boolean; current: string; justChanged: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(changeClinicSlug.bind(null, slug), {});
  const [value, setValue] = useState(current);
  const [confirm, setConfirm] = useState(false);
  const localProblem = value !== current ? slugProblem(value) : null;

  return (
    <Card>
      <CardHeader title="Endereço da página de agendamento" icon={Link2} />
      <form id="slug-form" action={action} noValidate className="flex flex-col gap-4 px-5 pb-5">
        {justChanged && !state.message && <FormNotice tone="success">Endereço alterado. O antigo continua redirecionando por 90 dias.</FormNotice>}
        {state.message && <FormNotice tone="danger">{state.message}</FormNotice>}
        <Field label="Endereço" error={state.fields?.slug ?? localProblem ?? undefined} hint={`/agendar/${value || "…"}`}>
          <Input
            name="slug"
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            disabled={!writable}
            autoCapitalize="none"
            spellCheck={false}
            maxLength={48}
          />
        </Field>
        <Button
          type="button"
          variant="secondary"
          loading={pending}
          disabled={!writable || value === current || Boolean(localProblem)}
          onClick={() => setConfirm(true)}
          className="self-start"
        >
          Alterar endereço
        </Button>
      </form>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Alterar o endereço da clínica?"
        description={
          <>
            Links já compartilhados com <strong>/agendar/{current}</strong> continuam funcionando por 90 dias, redirecionando para{" "}
            <strong>/agendar/{value}</strong>. Depois disso, atualize onde o link aparece (Instagram, Google, cartões).
          </>
        }
        confirmLabel="Alterar endereço"
        onConfirm={() => (document.getElementById("slug-form") as HTMLFormElement | null)?.requestSubmit()}
      />
    </Card>
  );
}
