"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ListPlus, Pencil, UserMinus, Users } from "lucide-react";
import { select, useDb } from "@/modules/clinic/client";
import { can, useSession } from "@/components/session-context";
import { PatientPicker } from "@/modules/patients/components/patient-picker";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import type { DayPeriod, Patient, WaitingEntry } from "@/prototype/types";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/ui/field";
import { Avatar, Card, EmptyState, PageHeader } from "@/ui/primitives";
import { Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";
import { fmt, phone } from "@/lib/format";
import { cn } from "@/lib/cn";
import { saveWaitingEntry, setWaitingEntryStatus } from "../actions";
import { PERIOD_LABEL, WEEKDAY_SHORT } from "../labels";
import { OpportunitiesNav } from "./opportunities-nav";

type Editing = { entry?: WaitingEntry; patientId?: string } | null;

export function WaitingListManager() {
  const db = useDb();
  const session = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const { org } = useParams<{ org: string }>();
  const canWrite = can(session, "appointments.write") || can(session, "appointments.write_own");
  const [editing, setEditing] = useState<Editing>(() => (params.get("novo") === "1" ? { patientId: params.get("paciente") ?? undefined } : null));
  const [removing, setRemoving] = useState<WaitingEntry | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (params.get("novo") === "1") router.replace(`/c/${org}/inicio/oportunidades/espera`);
  }, [params, org, router]);

  const rows = db.waitingList.filter((w) => w.status === "waiting");

  return (
    <>
      <OpportunitiesNav />
      <PageHeader
        title="Lista de espera"
        description="Pacientes que querem um horário. Quando um horário abre, eles aparecem como sugestão nas Oportunidades — o agendamento é sempre confirmado por alguém da equipe."
        actions={
          canWrite && (
            <Button onClick={() => setEditing({})}>
              <ListPlus className="size-4" aria-hidden /> Adicionar à lista
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="Ninguém na lista de espera" description="Adicione quem pediu um horário que não estava disponível. Você escolhe serviço, profissional e preferências." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((w) => {
              const patient = select.patient(db, w.patientId);
              return (
                <li key={w.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={patient?.name ?? "Paciente"} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium">{patient?.name ?? "Paciente"}</p>
                      <p className="text-body-sm text-ink-2">{preferences(db, w)}</p>
                      <p className="tabular text-caption text-ink-3">
                        {patient?.phone ? `${phone(patient.phone)} · ` : ""}na lista desde {fmt(w.createdAt, "dd/MM")}
                      </p>
                      {w.notes && <p className="text-caption text-ink-2">“{w.notes}”</p>}
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ entry: w })} aria-label={`Editar pedido de ${patient?.name ?? "paciente"}`}>
                        <Pencil className="size-4" aria-hidden /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(w)} aria-label={`Retirar ${patient?.name ?? "paciente"} da lista`}>
                        <UserMinus className="size-4" aria-hidden /> Retirar
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.entry ? "Editar pedido" : "Adicionar à lista de espera"}
        description="Sem preferência marcada, vale qualquer dia e horário."
      >
        {editing && <WaitingForm key={editing.entry?.id ?? "new"} editing={editing} onDone={() => setEditing(null)} />}
      </Sheet>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Retirar da lista de espera?"
        description={`${select.patient(db, removing?.patientId ?? null)?.name ?? "O paciente"} deixa de aparecer nas sugestões de horário.`}
        confirmLabel="Retirar"
        onConfirm={() =>
          start(async () => {
            if (!removing) return;
            const r = await setWaitingEntryStatus(org, removing.id, "removed");
            toast({ message: r.ok ? "Retirado da lista de espera." : (r.message ?? "Não foi possível retirar."), tone: r.ok ? "success" : "danger" });
            setRemoving(null);
          })
        }
      />
      {pending && <span className="sr-only" role="status">Salvando…</span>}
    </>
  );
}

function preferences(db: ReturnType<typeof useDb>, w: WaitingEntry) {
  const service = w.serviceId ? select.service(db, w.serviceId).name : "Qualquer serviço";
  const pro = w.professionalId ? select.professional(db, w.professionalId).name : "qualquer profissional";
  const when = [
    w.weekdays?.map((d) => WEEKDAY_SHORT[d]).join(", "),
    w.periods?.map((p) => PERIOD_LABEL[p].toLowerCase()).join(", "),
    w.earliestDate && `a partir de ${fmt(`${w.earliestDate}T12:00`, "dd/MM")}`,
    w.latestDate && `até ${fmt(`${w.latestDate}T12:00`, "dd/MM")}`,
  ].filter(Boolean);
  return `${service} · ${pro}${when.length ? ` · ${when.join(" · ")}` : ""}`;
}

function WaitingForm({ editing, onDone }: { editing: NonNullable<Editing>; onDone: () => void }) {
  const db = useDb();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const e = editing.entry;
  const ownId = db.viewer.role === "professional" ? db.viewer.professionalId : null;
  const [patient, setPatient] = useState<Patient | null>(() => select.patient(db, e?.patientId ?? editing.patientId ?? null) ?? null);
  const [professionalId, setProfessionalId] = useState(e?.professionalId ?? ownId ?? "");
  const [serviceId, setServiceId] = useState(e?.serviceId ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(e?.weekdays ?? []);
  const [periods, setPeriods] = useState<DayPeriod[]>(e?.periods ?? []);
  const [earliest, setEarliest] = useState(e?.earliestDate ?? "");
  const [latest, setLatest] = useState(e?.latestDate ?? "");
  const [notes, setNotes] = useState(e?.notes ?? "");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<string>();

  const services = db.services.filter((s) => s.active && (!professionalId || s.professionalIds.includes(professionalId)));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!patient) return setErrors({ patientId: "Escolha o paciente." });
        start(async () => {
          const r = await saveWaitingEntry(org, e?.id ?? null, {
            patientId: patient.id, serviceId, professionalId, weekdays, periods, earliestDate: earliest, latestDate: latest, notes,
          });
          if (!r.ok) {
            setErrors(r.fields ?? {});
            setMessage(r.message);
            return;
          }
          toast({ message: e ? "Pedido atualizado." : `${patient.name} entrou na lista de espera.`, tone: "success" });
          onDone();
        });
      }}
    >
      {message && <FormNotice tone="danger">{message}</FormNotice>}
      {e ? (
        <p className="font-medium">{patient?.name}</p>
      ) : (
        <div>
          <PatientPicker db={db} value={patient} onChange={setPatient} autoFocus />
          {errors.patientId && <p className="mt-1.5 text-caption text-danger">{errors.patientId}</p>}
        </div>
      )}

      <Field label="Profissional" optional={!ownId}>
        <Select
          value={professionalId}
          disabled={!!ownId}
          onChange={(ev) => {
            setProfessionalId(ev.target.value);
            setServiceId("");
          }}
        >
          {!ownId && <option value="">Qualquer profissional</option>}
          {select.activeProfessionals(db).filter((p) => !ownId || p.id === ownId).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Serviço" optional error={errors.serviceId}>
        <Select value={serviceId} onChange={(ev) => setServiceId(ev.target.value)}>
          <option value="">Qualquer serviço</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset>
        <legend className="mb-2 text-body-sm font-medium">Dias da semana <span className="font-normal text-ink-3">(opcional)</span></legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_SHORT.map((label, d) => (
            <Chip key={label} checked={weekdays.includes(d)} onChange={() => setWeekdays(toggle(weekdays, d))}>
              {label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-body-sm font-medium">Período <span className="font-normal text-ink-3">(opcional)</span></legend>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(PERIOD_LABEL) as [DayPeriod, string][]).map(([p, label]) => (
            <Chip key={p} checked={periods.includes(p)} onChange={() => setPeriods(toggle(periods, p))}>
              {label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="A partir de" optional error={errors.earliestDate}>
          <Input type="date" value={earliest} onChange={(ev) => setEarliest(ev.target.value)} />
        </Field>
        <Field label="Até" optional error={errors.latestDate}>
          <Input type="date" value={latest} min={earliest || undefined} onChange={(ev) => setLatest(ev.target.value)} />
        </Field>
      </div>

      <Field label="Observação" optional error={errors.notes} hint="Só o combinado (ex.: “prefere ser avisado por mensagem”). Não registre informações clínicas.">
        <Textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} rows={2} maxLength={300} className="min-h-16" />
      </Field>

      <Button type="submit" size="lg" loading={pending}>
        {e ? "Salvar" : "Adicionar à lista"}
      </Button>
    </form>
  );
}

export function Chip({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "inline-flex h-9 cursor-pointer items-center rounded-full border px-3 text-body-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
        checked ? "border-accent bg-accent-subtle text-accent" : "border-line-strong",
      )}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}
