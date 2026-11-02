"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addDays, format } from "date-fns";
import { CalendarPlus, Check, Pencil, Repeat, RotateCcw, X } from "lucide-react";
import { select, useDb } from "@/modules/clinic/client";
import { can, useSession } from "@/components/session-context";
import { PatientPicker } from "@/modules/patients/components/patient-picker";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import type { FollowUp, Patient } from "@/prototype/types";
import { Button } from "@/ui/button";
import { Field, Input, Select } from "@/ui/field";
import { Card, EmptyState, PageHeader } from "@/ui/primitives";
import { Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/cn";
import { saveFollowUp, setFollowUpStatus } from "../actions";
import { bookingHref, firstBookableSlot } from "../booking";
import { OpportunitiesNav } from "./opportunities-nav";
import { secondaryLink } from "./opportunity-card";

type Editing = { followUp?: FollowUp; patientId?: string; professionalId?: string; serviceId?: string; sourceId?: string } | null;

const STATUS: Record<FollowUp["status"], string> = { pending: "Pendente", scheduled: "Agendado", done: "Concluído", cancelled: "Cancelado" };
const QUICK = [7, 15, 30, 60, 90];
const day = (iso: string) => fmt(`${iso}T12:00`, "dd/MM/yyyy");

export function FollowUpsManager() {
  const db = useDb();
  const session = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const canWrite = can(session, "appointments.write") || can(session, "appointments.write_own");
  const [editing, setEditing] = useState<Editing>(() =>
    params.get("novo") === "1"
      ? {
          patientId: params.get("paciente") ?? undefined,
          professionalId: params.get("profissional") ?? undefined,
          serviceId: params.get("servico") ?? undefined,
          sourceId: params.get("origem") ?? undefined,
        }
      : null,
  );
  useEffect(() => {
    if (params.get("novo") === "1") router.replace(`/c/${org}/inicio/oportunidades/retornos`);
  }, [params, org, router]);

  const today = format(new Date(), "yyyy-MM-dd");
  const open = db.followUps.filter((f) => f.status === "pending" || f.status === "scheduled");
  const closed = db.followUps.filter((f) => f.status === "done" || f.status === "cancelled");
  const mine = (f: FollowUp) => can(session, "appointments.write") || f.professionalId === db.viewer.professionalId;

  const change = (f: FollowUp, status: "done" | "cancelled" | "pending", ok: string) =>
    start(async () => {
      const r = await setFollowUpStatus(org, f.id, status);
      toast({ message: r.ok ? ok : (r.message ?? "Não foi possível alterar."), tone: r.ok ? "success" : "danger" });
    });

  const row = (f: FollowUp) => {
    const patient = select.patient(db, f.patientId);
    const overdue = f.status === "pending" && f.dueDate < today;
    const appt = f.appointmentId ? db.appointments.find((a) => a.id === f.appointmentId) : undefined;
    const serviceId = f.serviceId ?? db.services.find((s) => s.active && s.professionalIds.includes(f.professionalId))?.id;
    const slot = f.status === "pending" && serviceId ? firstBookableSlot(db, f.professionalId, serviceId, new Date()) : null;
    return (
      <li key={f.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="font-medium">{patient?.name ?? "Paciente"}</p>
          <p className="text-body-sm text-ink-2">
            {select.professional(db, f.professionalId).name}
            {f.serviceId && ` · ${select.service(db, f.serviceId).name}`}
          </p>
          <p className={cn("tabular text-caption", overdue ? "font-medium text-danger" : "text-ink-2")}>
            {STATUS[f.status]} · {f.status === "scheduled" && appt ? `agendado para ${fmt(appt.startsAt, "dd/MM 'às' HH:mm")}` : `${overdue ? "prazo venceu em" : "prazo"} ${day(f.dueDate)}`}
          </p>
        </div>
        {canWrite && mine(f) && (
          <div className="flex shrink-0 flex-wrap gap-1">
            {f.status === "pending" && (
              <>
                {serviceId && (
                  <Link href={bookingHref(org, { professionalId: f.professionalId, start: slot, serviceId, patientId: f.patientId })} className={secondaryLink}>
                    <CalendarPlus className="size-4" aria-hidden /> Agendar
                  </Link>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing({ followUp: f })} aria-label={`Editar retorno de ${patient?.name ?? "paciente"}`}>
                  <Pencil className="size-4" aria-hidden /> Editar
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => change(f, "done", "Retorno marcado como feito.")} aria-label={`Marcar retorno de ${patient?.name ?? "paciente"} como feito`}>
                  <Check className="size-4" aria-hidden /> Marcar como feito
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => change(f, "cancelled", "Retorno cancelado.")} aria-label={`Cancelar retorno de ${patient?.name ?? "paciente"}`}>
                  <X className="size-4" aria-hidden /> Cancelar
                </Button>
              </>
            )}
            {f.status === "cancelled" && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => change(f, "pending", "Retorno reaberto.")} aria-label={`Reabrir retorno de ${patient?.name ?? "paciente"}`}>
                <RotateCcw className="size-4" aria-hidden /> Reabrir
              </Button>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <OpportunitiesNav />
      <PageHeader
        title="Retornos"
        description="Retornos combinados com o paciente. Só entra aqui o que alguém registrou: o sistema não deduz retorno pelo histórico."
        actions={
          canWrite && (
            <Button onClick={() => setEditing({})}>
              <Repeat className="size-4" aria-hidden /> Registrar retorno
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        {open.length === 0 ? (
          <EmptyState icon={Repeat} title="Nenhum retorno em aberto" description="Registre um retorno ao concluir um atendimento ou aqui mesmo. Quando o prazo chegar, ele aparece nas Oportunidades." />
        ) : (
          <ul className="divide-y divide-line">{open.map(row)}</ul>
        )}
      </Card>

      {closed.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-body-sm font-medium text-ink-2">Concluídos e cancelados ({closed.length})</summary>
          <Card className="mt-2 overflow-hidden">
            <ul className="divide-y divide-line">{closed.map(row)}</ul>
          </Card>
        </details>
      )}

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing?.followUp ? "Editar retorno" : "Registrar retorno"} description="Sem informações clínicas: só quem, com quem e até quando.">
        {editing && <FollowUpForm key={editing.followUp?.id ?? "new"} editing={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}

function FollowUpForm({ editing, onDone }: { editing: NonNullable<Editing>; onDone: () => void }) {
  const db = useDb();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const f = editing.followUp;
  const ownId = db.viewer.role === "professional" ? db.viewer.professionalId : null;
  const [patient, setPatient] = useState<Patient | null>(() => select.patient(db, f?.patientId ?? editing.patientId ?? null) ?? null);
  const [professionalId, setProfessionalId] = useState(f?.professionalId ?? editing.professionalId ?? ownId ?? select.activeProfessionals(db)[0]?.id ?? "");
  const services = db.services.filter((s) => s.active && s.professionalIds.includes(professionalId));
  const [serviceId, setServiceId] = useState(f?.serviceId ?? (services.some((s) => s.id === editing.serviceId) ? editing.serviceId! : ""));
  const [dueDate, setDueDate] = useState(f?.dueDate ?? format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<string>();

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!patient) return setErrors({ patientId: "Escolha o paciente." });
        start(async () => {
          const r = await saveFollowUp(org, f?.id ?? null, {
            patientId: patient.id, professionalId, serviceId, dueDate, sourceAppointmentId: f ? undefined : editing.sourceId,
          });
          if (!r.ok) {
            setErrors(r.fields ?? {});
            setMessage(r.message);
            return;
          }
          toast({ message: f ? "Retorno atualizado." : "Retorno registrado.", tone: "success" });
          onDone();
        });
      }}
    >
      {message && <FormNotice tone="danger">{message}</FormNotice>}
      {f ? (
        <p className="font-medium">{patient?.name}</p>
      ) : (
        <div>
          <PatientPicker db={db} value={patient} onChange={setPatient} autoFocus={!editing.patientId} />
          {errors.patientId && <p className="mt-1.5 text-caption text-danger">{errors.patientId}</p>}
        </div>
      )}

      <Field label="Profissional" error={errors.professionalId}>
        <Select
          value={professionalId}
          disabled={!!f || !!ownId}
          onChange={(e) => {
            setProfessionalId(e.target.value);
            setServiceId("");
          }}
        >
          {select.activeProfessionals(db).filter((p) => !ownId || p.id === ownId).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Serviço" optional>
        <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Sem serviço definido</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset>
        <legend className="mb-2 text-body-sm font-medium">Prazo</legend>
        <div className="mb-2 flex flex-wrap gap-2">
          {QUICK.map((d) => {
            const v = format(addDays(new Date(), d), "yyyy-MM-dd");
            return (
              <Button key={d} size="sm" variant={dueDate === v ? "primary" : "secondary"} onClick={() => setDueDate(v)} aria-pressed={dueDate === v}>
                {d} dias
              </Button>
            );
          })}
        </div>
        <Field label="Data limite" error={errors.dueDate}>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </fieldset>

      <Button type="submit" size="lg" loading={pending}>
        {f ? "Salvar" : "Registrar retorno"}
      </Button>
    </form>
  );
}
