"use client";

import { useRouter, useSearchParams, useParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Search, Upload, UserPlus, Users } from "lucide-react";
import { actions, useDb } from "@/prototype/store";
import type { Db } from "@/prototype/types";
import { Button } from "@/ui/button";
import { Field, Input, Textarea } from "@/ui/field";
import { Avatar, Card, EmptyState, PageHeader } from "@/ui/primitives";
import { Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";
import { fmt, maskPhone, phone, toE164 } from "@/lib/format";

export default function PacientesPage() {
  return (
    <Suspense>
      <Patients />
    </Suspense>
  );
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Patients() {
  const db = useDb();
  const params = useSearchParams();
  const router = useRouter();
  const { org } = useParams<{ org: string }>();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(() => params.get("novo") === "1");

  // Limpa ?novo=1 da URL depois de abrir o painel (ação rápida do Início).
  useEffect(() => {
    if (params.get("novo") === "1") router.replace(`/c/${org}/pacientes`);
  }, [params, org, router]);

  const rows = useMemo(() => {
    if (!db) return [];
    // Profissional vê apenas pacientes dos próprios atendimentos (D-06).
    const own = db.viewer.role === "professional"
      ? new Set(db.appointments.filter((a) => a.professionalId === db.viewer.professionalId).map((a) => a.patientId))
      : null;
    const query = norm(q.trim());
    const digits = query.replace(/\D/g, "");
    return db.patients
      .filter((p) => !own || own.has(p.id))
      .filter((p) => !query || norm(p.name).includes(query) || (digits.length >= 3 && p.phone.includes(digits)))
      .map((p) => {
        const appts = db.appointments.filter((a) => a.patientId === p.id).sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
        const next = appts.filter((a) => a.status === "confirmed" && new Date(a.startsAt) > new Date()).at(-1);
        const last = appts.find((a) => a.status === "completed");
        return { p, next, last, total: appts.length };
      })
      .sort((a, b) => a.p.name.localeCompare(b.p.name));
  }, [db, q]);

  if (!db) return null;

  return (
    <>
      <PageHeader
        title="Pacientes"
        description={db.viewer.role === "professional" ? "Pacientes dos seus atendimentos." : `${db.patients.length} cadastrados`}
        actions={
          db.viewer.role !== "professional" && (
            <>
              <Button variant="secondary" disabled title="Fase 7">
                <Upload className="size-4" aria-hidden /> Importar planilha
              </Button>
              <Button onClick={() => setCreating(true)}>
                <UserPlus className="size-4" aria-hidden /> Novo paciente
              </Button>
            </>
          )
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <label htmlFor="busca" className="sr-only">Buscar paciente</label>
        <Input id="busca" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou telefone" className="pl-9" />
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={q ? "Nenhum paciente encontrado" : "Nenhum paciente ainda"} description={q ? "Tente outro nome ou parte do telefone." : undefined} />
        ) : (
          <>
            <table className="hidden w-full text-body-sm md:table">
              <thead className="bg-canvas text-left text-caption text-ink-2">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Nome</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Telefone</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Último atendimento</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Próximo</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Agendamentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ p, next, last, total }) => (
                  <tr key={p.id} className="hover:bg-canvas">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3">
                        <Avatar name={p.name} size="sm" />
                        <span className="font-medium">{p.name}</span>
                      </span>
                    </td>
                    <td className="tabular px-5 py-3 text-ink-2">{phone(p.phone)}</td>
                    <td className="tabular px-5 py-3 text-ink-2">{last ? fmt(last.startsAt, "dd/MM/yyyy") : "—"}</td>
                    <td className="tabular px-5 py-3">{next ? fmt(next.startsAt, "dd/MM 'às' HH:mm") : <span className="text-ink-3">—</span>}</td>
                    <td className="tabular px-5 py-3 text-right text-ink-2">{total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line md:hidden">
              {rows.map(({ p, next }) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={p.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="tabular text-caption text-ink-2">
                      {phone(p.phone)}
                      {next && ` · próximo ${fmt(next.startsAt, "dd/MM")}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Sheet open={creating} onOpenChange={setCreating} title="Novo paciente" description="Somente o essencial. Você completa depois.">
        <NewPatientForm db={db} onDone={() => setCreating(false)} />
      </Sheet>
    </>
  );
}

function NewPatientForm({ db, onDone }: { db: Db; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [birth, setBirth] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const e164 = toE164(tel);
  const dup = e164 ? db.patients.find((p) => p.phone === e164) : undefined;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const err: Record<string, string> = {};
        if (name.trim().length < 3) err.name = "Informe o nome completo.";
        if (!e164 && !email) err.tel = "Informe um celular com DDD ou um e-mail.";
        if (tel && !e164) err.tel = "Celular inválido. Use DDD + número.";
        if (email && !/^\S+@\S+\.\S+$/.test(email)) err.email = "E-mail inválido.";
        setErrors(err);
        if (Object.keys(err).length) return;
        actions.createPatient({ name: name.trim(), phone: e164 ?? "", email: email || undefined, birthDate: birth || undefined, notes: notes || undefined });
        toast({ message: `${name.trim()} cadastrado(a).`, tone: "success" });
        onDone();
      }}
    >
      <Field label="Nome completo" error={errors.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" />
      </Field>
      <Field label="Celular" error={errors.tel} hint={dup ? undefined : "Com DDD."}>
        <Input inputMode="tel" value={tel} onChange={(e) => setTel(maskPhone(e.target.value))} placeholder="(11) 90000-0000" autoComplete="off" />
      </Field>
      {dup && (
        <p role="status" className="-mt-2 rounded-sm bg-warning-subtle p-2.5 text-body-sm text-warning">
          Possível duplicidade: este telefone já pertence a <strong>{dup.name}</strong>.
        </p>
      )}
      <Field label="E-mail" optional error={errors.email}>
        <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Data de nascimento" optional>
        <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
      </Field>
      <Field label="Observações administrativas" optional hint="Não registre informações clínicas aqui.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      <Button type="submit" size="lg">
        Cadastrar paciente
      </Button>
    </form>
  );
}
