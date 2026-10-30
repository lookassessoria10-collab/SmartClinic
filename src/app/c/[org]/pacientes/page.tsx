"use client";

import { useRouter, useSearchParams, useParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { History, Pencil, Search, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { select, useDb } from "@/modules/clinic/client";
import { deletePatient, savePatient } from "@/modules/patients/actions";
import { can, useSession } from "@/components/session-context";
import type { Db, Patient } from "@/prototype/types";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/ui/field";
import { Avatar, Card, EmptyState, PageHeader } from "@/ui/primitives";
import { Sheet } from "@/ui/sheet";
import { StatusBadge } from "@/ui/status-badge";
import { useToast } from "@/ui/toast";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import { fmt, maskPhone, phone, toE164 } from "@/lib/format";

export default function PacientesPage() {
  return (
    <Suspense>
      <Patients />
    </Suspense>
  );
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Editing = { mode: "new" } | { mode: "edit"; patient: Patient } | { mode: "view"; patient: Patient } | null;

function Patients() {
  const db = useDb();
  const session = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const { org } = useParams<{ org: string }>();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Editing>(() => (params.get("novo") === "1" ? { mode: "new" } : null));
  const canWrite = can(session, "patients.write") || can(session, "patients.write_own");

  // Limpa ?novo=1 da URL depois de abrir o painel (ação rápida do Início).
  useEffect(() => {
    if (params.get("novo") === "1") router.replace(`/c/${org}/pacientes`);
  }, [params, org, router]);

  // O banco já entrega só os pacientes que a pessoa pode ver (profissional: os próprios, D-06).
  const rows = useMemo(() => {
    const query = norm(q.trim());
    const digits = query.replace(/\D/g, "");
    return db.patients
      .filter((p) => !query || norm(p.name).includes(query) || (digits.length >= 3 && p.phone.includes(digits)))
      .map((p) => {
        const appts = db.appointments.filter((a) => a.patientId === p.id).sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
        const next = appts.filter((a) => a.status === "confirmed" && new Date(a.startsAt) > new Date()).at(-1);
        const last = appts.find((a) => a.status === "completed");
        return { p, next, last, total: appts.length };
      });
  }, [db, q]);

  return (
    <>
      <PageHeader
        title="Pacientes"
        description={db.viewer.role === "professional" ? "Pacientes dos seus atendimentos e os que você cadastrou." : `${db.patients.length} cadastrado${db.patients.length === 1 ? "" : "s"}`}
        actions={
          canWrite && (
            <>
              {db.viewer.role !== "professional" && (
                <Button variant="secondary" disabled title="Em breve">
                  <Upload className="size-4" aria-hidden /> Importar planilha
                </Button>
              )}
              <Button onClick={() => setEditing({ mode: "new" })}>
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
          <EmptyState
            icon={Users}
            title={q ? "Nenhum paciente encontrado" : "Nenhum paciente ainda"}
            description={q ? "Tente outro nome ou parte do telefone." : canWrite ? "Cadastre o primeiro em “Novo paciente” ou direto ao agendar." : undefined}
          />
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
                      <button className="flex items-center gap-3 text-left font-medium hover:text-accent" onClick={() => setEditing({ mode: "view", patient: p })}>
                        <Avatar name={p.name} size="sm" />
                        {p.name}
                      </button>
                    </td>
                    <td className="tabular px-5 py-3 text-ink-2">{p.phone ? phone(p.phone) : "—"}</td>
                    <td className="tabular px-5 py-3 text-ink-2">{last ? fmt(last.startsAt, "dd/MM/yyyy") : "—"}</td>
                    <td className="tabular px-5 py-3">{next ? fmt(next.startsAt, "dd/MM 'às' HH:mm") : <span className="text-ink-3">—</span>}</td>
                    <td className="tabular px-5 py-3 text-right text-ink-2">{total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line md:hidden">
              {rows.map(({ p, next }) => (
                <li key={p.id}>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setEditing({ mode: "view", patient: p })}>
                    <Avatar name={p.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="tabular block text-caption text-ink-2">
                        {p.phone ? phone(p.phone) : "Sem telefone"}
                        {next && ` · próximo ${fmt(next.startsAt, "dd/MM")}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.mode === "new" ? "Novo paciente" : editing?.mode === "edit" ? "Editar paciente" : editing?.patient.name ?? ""}
        description={editing?.mode === "new" ? "Somente o essencial. Você completa depois." : undefined}
      >
        {editing?.mode === "view" ? (
          <PatientDetails db={db} patient={editing.patient} canWrite={canWrite} canDelete={can(session, "patients.delete")} onEdit={() => setEditing({ mode: "edit", patient: editing.patient })} onClose={() => setEditing(null)} />
        ) : editing ? (
          <PatientForm key={editing.mode === "edit" ? editing.patient.id : "new"} db={db} patient={editing.mode === "edit" ? editing.patient : undefined} onDone={() => setEditing(null)} />
        ) : null}
      </Sheet>
    </>
  );
}

function PatientDetails({ db, patient, canWrite, canDelete, onEdit, onClose }: { db: Db; patient: Patient; canWrite: boolean; canDelete: boolean; onEdit: () => void; onClose: () => void }) {
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const history = db.appointments.filter((a) => a.patientId === patient.id).sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
        <dt className="text-ink-2">Celular</dt>
        <dd className="tabular">{patient.phone ? phone(patient.phone) : "—"}</dd>
        <dt className="text-ink-2">E-mail</dt>
        <dd className="break-all">{patient.email ?? "—"}</dd>
        <dt className="text-ink-2">Nascimento</dt>
        <dd className="tabular">{patient.birthDate ? fmt(`${patient.birthDate}T12:00`, "dd/MM/yyyy") : "—"}</dd>
      </dl>
      {patient.notes && (
        <div className="rounded-sm bg-canvas p-3 text-body-sm">
          <p className="mb-1 text-caption font-semibold text-ink-2">Observações administrativas</p>
          <p className="whitespace-pre-line">{patient.notes}</p>
        </div>
      )}

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-caption font-semibold text-ink-2">
          <History className="size-3.5" aria-hidden /> Agendamentos
        </h3>
        {history.length === 0 ? (
          <p className="text-body-sm text-ink-3">Nenhum agendamento ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-sm border border-line">
            {history.slice(0, 20).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-body-sm">
                <span className="min-w-0">
                  <span className="tabular block">{fmt(a.startsAt, "dd/MM/yyyy HH:mm")}</span>
                  <span className="block truncate text-caption text-ink-2">
                    {select.service(db, a.serviceId).name} · {select.professional(db, a.professionalId).name}
                  </span>
                </span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {canWrite && (
          <Button variant="secondary" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden /> Editar
          </Button>
        )}
        {canDelete && (
          <Button variant="ghost" className="text-danger hover:bg-danger-subtle hover:text-danger" loading={pending} onClick={() => setConfirm(true)}>
            <Trash2 className="size-4" aria-hidden /> Excluir
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive
        title={`Excluir ${patient.name}?`}
        description="O cadastro sai das listas e da busca. Os atendimentos passados continuam no histórico da agenda. Pacientes com agendamentos futuros não podem ser excluídos."
        confirmLabel="Excluir paciente"
        onConfirm={() =>
          start(async () => {
            const r = await deletePatient(org, patient.id);
            toast({ message: r.ok ? "Paciente excluído." : (r.message ?? "Não foi possível excluir."), tone: r.ok ? "success" : "danger" });
            if (r.ok) onClose();
          })
        }
      />
    </div>
  );
}

function PatientForm({ db, patient, onDone }: { db: Db; patient?: Patient; onDone: () => void }) {
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(patient?.name ?? "");
  const [tel, setTel] = useState(patient?.phone ? maskPhone(patient.phone.replace(/^\+55/, "")) : "");
  const [email, setEmail] = useState(patient?.email ?? "");
  const [birth, setBirth] = useState(patient?.birthDate ?? "");
  const [notes, setNotes] = useState(patient?.notes ?? "");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<string>();
  const e164 = toE164(tel);
  const dup = e164 ? db.patients.find((p) => p.phone === e164 && p.id !== patient?.id) : undefined;

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!tel.trim() && !email.trim()) return setErrors({ phone: "Informe um celular com DDD ou um e-mail." });
        start(async () => {
          const r = await savePatient(org, patient?.id ?? null, { name, phone: tel, email, birthDate: birth, notes });
          if (!r.ok) {
            setErrors(r.fields ?? {});
            setMessage(r.fields ? undefined : r.message);
            return;
          }
          toast({ message: patient ? "Dados salvos." : `${name.trim()} cadastrado(a).`, tone: "success" });
          onDone();
        });
      }}
    >
      {message && <FormNotice tone="danger">{message}</FormNotice>}
      <Field label="Nome completo" error={errors.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" />
      </Field>
      <Field label="Celular" error={errors.phone} hint={dup ? undefined : "Com DDD."}>
        <Input inputMode="tel" value={tel} onChange={(e) => setTel(maskPhone(e.target.value))} placeholder="(11) 90000-0000" autoComplete="off" />
      </Field>
      {dup && (
        <p role="status" className="-mt-2 rounded-sm bg-warning-subtle p-2.5 text-body-sm text-warning">
          Possível duplicidade: este telefone já está no cadastro de <strong>{dup.name}</strong>. Se for outra pessoa da mesma família, pode continuar.
        </p>
      )}
      <Field label="E-mail" optional error={errors.email}>
        <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Data de nascimento" optional error={errors.birthDate}>
        <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
      </Field>
      <Field label="Observações administrativas" optional error={errors.notes} hint="Não registre informações clínicas aqui.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {patient ? "Salvar alterações" : "Cadastrar paciente"}
      </Button>
    </form>
  );
}
