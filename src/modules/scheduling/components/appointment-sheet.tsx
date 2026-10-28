"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { format, startOfDay } from "date-fns";
import { AlertTriangle, CalendarClock, History, Phone, StickyNote } from "lucide-react";
import { freeSlots } from "@/modules/availability/rules";
import { PatientPicker } from "@/modules/patients/components/patient-picker";
import { actions, select } from "@/prototype/store";
import type { Db, Patient } from "@/prototype/types";
import { Sheet } from "@/ui/sheet";
import { Button } from "@/ui/button";
import { Field, Select, Textarea } from "@/ui/field";
import { StatusBadge, statusMeta } from "@/ui/status-badge";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { useToast } from "@/ui/toast";
import { cap, dayLabel, fmt, phone, time } from "@/lib/format";
import { cn } from "@/lib/cn";

export type SheetState =
  | { mode: "create"; professionalId: string; start: Date }
  | { mode: "view"; id: string }
  | null;

export function AppointmentSheet({ db, state, onClose, onCreated }: { db: Db; state: SheetState; onClose: () => void; onCreated?: (id: string) => void }) {
  return (
    <Sheet
      open={state !== null}
      onOpenChange={(o) => !o && onClose()}
      title={state?.mode === "create" ? "Novo agendamento" : "Agendamento"}
      description={state?.mode === "create" ? `${fmt(state.start, "EEEE, d 'de' MMMM")}` : undefined}
    >
      {state?.mode === "create" && <CreateForm key={`${state.professionalId}-${+state.start}`} db={db} initial={state} onDone={(id) => { onCreated?.(id); onClose(); }} />}
      {state?.mode === "view" && <Details key={state.id} db={db} id={state.id} onClose={onClose} />}
    </Sheet>
  );
}

/* ---------- Criação ---------- */

function useSlots(db: Db, professionalId: string, serviceId: string, day: Date, ignoreId?: string) {
  return useMemo(() => {
    const svc = select.service(db, serviceId);
    if (!svc) return [];
    return freeSlots({
      day, professionalId, durationMin: svc.durationMin, bufferAfterMin: svc.bufferAfterMin,
      stepMin: 15, rules: db.availability, blocks: db.blocks, appointments: db.appointments, notBefore: new Date(), ignoreAppointmentId: ignoreId,
    });
  }, [db, professionalId, serviceId, day, ignoreId]);
}

function CreateForm({ db, initial, onDone }: { db: Db; initial: { professionalId: string; start: Date }; onDone: (id: string) => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [professionalId, setProfessionalId] = useState(initial.professionalId);
  const servicesFor = db.services.filter((s) => s.professionalIds.includes(professionalId));
  const [serviceId, setServiceId] = useState(servicesFor[0]?.id ?? "");
  const [day, setDay] = useState(startOfDay(initial.start));
  const [start, setStart] = useState<number>(+initial.start);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<{ message: string; suggestions: Date[] } | null>(null);
  const [touched, setTouched] = useState(false);

  const slots = useSlots(db, professionalId, serviceId, day);
  const svc = select.service(db, serviceId);
  const startValid = slots.some((s) => +s === start);

  function save() {
    setTouched(true);
    if (!patient || !svc || !startValid) return;
    const res = actions.book({ professionalId, serviceId, patientId: patient.id, startsAt: new Date(start), notes: notes || undefined });
    if (!res.ok) return setError({ message: res.error, suggestions: res.suggestions });
    toast({
      message: `Agendado: ${patient.name}, ${dayLabel(new Date(start)).toLowerCase()} às ${time(new Date(start))}.`,
      tone: "success",
      action: { label: "Desfazer", onClick: () => actions.setStatus(res.id, "cancelled", "Desfeito logo após criar") },
    });
    onDone(res.id);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div>
        <PatientPicker db={db} value={patient} onChange={setPatient} autoFocus />
        {touched && !patient && <p className="mt-1.5 text-caption text-danger">Escolha ou cadastre o paciente.</p>}
      </div>

      <Field label="Profissional">
        <Select
          value={professionalId}
          onChange={(e) => {
            const pid = e.target.value;
            setProfessionalId(pid);
            const first = db.services.find((s) => s.professionalIds.includes(pid));
            setServiceId(first?.id ?? "");
          }}
        >
          {db.professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Serviço" hint={svc ? `${svc.durationMin} min${svc.bufferAfterMin ? ` + ${svc.bufferAfterMin} min de intervalo` : ""}` : undefined}>
        <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          {servicesFor.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <input
            type="date"
            value={format(day, "yyyy-MM-dd")}
            min={format(new Date(), "yyyy-MM-dd")}
            onChange={(e) => e.target.value && setDay(startOfDay(new Date(`${e.target.value}T00:00`)))}
            className="h-11 w-full rounded-sm border border-line-strong bg-surface px-3 text-body shadow-xs focus-visible:border-accent focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
          />
        </Field>
        <Field label="Horário" error={touched && !startValid ? (slots.length ? "Escolha um horário livre." : "Sem horários livres.") : undefined}>
          <Select value={startValid ? String(start) : ""} onChange={(e) => setStart(Number(e.target.value))}>
            <option value="" disabled>
              {slots.length ? "Escolher" : "Nenhum livre"}
            </option>
            {slots.map((s) => (
              <option key={+s} value={+s}>
                {time(s)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Observações administrativas" optional hint="Não registre informações clínicas aqui.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="min-h-16" />
      </Field>

      {error && (
        <div role="alert" className="rounded-sm border border-danger/30 bg-danger-subtle p-3 text-body-sm">
          <p className="flex items-center gap-1.5 font-medium text-danger">
            <AlertTriangle className="size-4" aria-hidden /> {error.message}
          </p>
          {error.suggestions.length > 0 && (
            <>
              <p className="mt-2 text-ink-2">Horários livres mais próximos:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {error.suggestions.map((s) => (
                  <Button key={+s} size="sm" variant="secondary" onClick={() => { setDay(startOfDay(s)); setStart(+s); setError(null); }}>
                    {dayLabel(s)}, {time(s)}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t border-line bg-surface px-4 py-3">
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          Agendar
        </Button>
      </div>
    </form>
  );
}

/* ---------- Detalhes, remarcação, status ---------- */

const CANCEL_REASONS = ["Paciente desmarcou", "Profissional indisponível", "Remarcado por telefone", "Outro"];

function Details({ db, id, onClose }: { db: Db; id: string; onClose: () => void }) {
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const a = db.appointments.find((x) => x.id === id);
  const [rescheduling, setRescheduling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);

  if (!a) return <p className="text-body-sm text-ink-2">Agendamento não encontrado.</p>;
  if (!select.canSeeDetails(db, a)) {
    return (
      <div className="text-body-sm text-ink-2">
        <p className="font-medium text-ink">Horário ocupado</p>
        <p className="mt-1">
          {select.professional(db, a.professionalId).name} · {time(a.startsAt)}–{time(a.endsAt)}
        </p>
        <p className="mt-3">Os detalhes deste atendimento não estão disponíveis para o seu perfil.</p>
      </div>
    );
  }

  const prof = select.professional(db, a.professionalId);
  const svc = select.service(db, a.serviceId);
  const patient = select.patient(db, a.patientId);
  const req = select.request(db, a.id);
  const started = new Date(a.startsAt) <= new Date();
  const history = db.events.filter((e) => e.appointmentId === a.id).reverse();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-headline font-semibold">{select.personName(db, a)}</p>
          {(patient?.phone || req?.phone) && (
            <p className="tabular mt-0.5 flex items-center gap-1.5 text-body-sm text-ink-2">
              <Phone className="size-3.5" aria-hidden /> {phone(patient?.phone ?? req!.phone)}
            </p>
          )}
        </div>
        <StatusBadge status={a.status} />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
        <dt className="text-ink-2">Quando</dt>
        <dd className="tabular">
          {cap(fmt(a.startsAt, "EEE, d 'de' MMM"))} · {time(a.startsAt)}–{time(a.endsAt)}
        </dd>
        <dt className="text-ink-2">Serviço</dt>
        <dd>{svc.name}</dd>
        <dt className="text-ink-2">Profissional</dt>
        <dd className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: `var(--agenda-${prof.color})` }} aria-hidden />
          {prof.name}
        </dd>
        <dt className="text-ink-2">Origem</dt>
        <dd>{a.origin === "public" ? "Página pública" : "Equipe"}</dd>
      </dl>

      {(a.notes || patient?.notes || req?.message) && (
        <div className="rounded-sm bg-canvas p-3 text-body-sm">
          <p className="mb-1 flex items-center gap-1.5 text-caption font-semibold text-ink-2">
            <StickyNote className="size-3.5" aria-hidden /> Observações administrativas
          </p>
          {[a.notes, patient?.notes, req?.message && `Mensagem do paciente: “${req.message}”`].filter(Boolean).map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}

      {a.status === "requested" && (
        <div className="rounded-sm border border-warning/30 bg-warning-subtle p-3 text-body-sm text-warning">
          Solicitação feita pela página pública. Revise para vincular ao cadastro do paciente.
          <Link href={`/c/${org}/agenda/solicitacoes?id=${a.id}`} className="mt-2 block font-semibold underline underline-offset-2">
            Revisar solicitação
          </Link>
        </div>
      )}

      {rescheduling && <Reschedule db={db} id={a.id} onDone={() => setRescheduling(false)} />}

      {!rescheduling && a.status === "confirmed" && (
        <div className="flex flex-col gap-2">
          {started && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => { actions.setStatus(a.id, "completed"); toast({ message: "Marcado como concluído.", tone: "success" }); }}>
                Concluído
              </Button>
              <Button variant="secondary" onClick={() => { actions.setStatus(a.id, "no_show"); toast({ message: "Falta registrada.", tone: "info" }); }}>
                Faltou
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setRescheduling(true)}>
              <CalendarClock className="size-4" aria-hidden /> Remarcar
            </Button>
            <Button variant="ghost" className="text-danger hover:bg-danger-subtle hover:text-danger" onClick={() => setConfirmCancel(true)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-caption font-semibold text-ink-2">
            <History className="size-3.5" aria-hidden /> Histórico
          </h3>
          <ol className="flex flex-col gap-1.5 border-l border-line pl-3 text-caption text-ink-2">
            {history.map((e, i) => (
              <li key={i}>
                <span className="font-medium text-ink">{statusMeta[e.to].label}</span> · {e.actor} · {fmt(e.at, "dd/MM HH:mm")}
                {e.reason && ` · ${e.reason}`}
              </li>
            ))}
          </ol>
        </section>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        destructive
        title="Cancelar agendamento?"
        description={`${select.personName(db, a)} · ${dayLabel(a.startsAt)}, ${time(a.startsAt)}. O horário ficará livre.`}
        confirmLabel="Cancelar agendamento"
        onConfirm={() => {
          const prev = { ...a };
          actions.setStatus(a.id, "cancelled", reason);
          onClose();
          toast({ message: "Agendamento cancelado.", tone: "info", action: { label: "Desfazer", onClick: () => actions.restore(prev) } });
        }}
      >
        <fieldset>
          <legend className="mb-2 text-body-sm font-medium">Motivo (opcional)</legend>
          <div className="flex flex-wrap gap-2">
            {CANCEL_REASONS.map((r) => (
              <label key={r} className={cn("inline-flex h-9 cursor-pointer items-center rounded-full border px-3 text-body-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent", reason === r ? "border-accent bg-accent-subtle text-accent" : "border-line-strong")}>
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="sr-only" />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
      </ConfirmDialog>
    </div>
  );
}

function Reschedule({ db, id, onDone }: { db: Db; id: string; onDone: () => void }) {
  const toast = useToast();
  const a = db.appointments.find((x) => x.id === id)!;
  const [day, setDay] = useState(startOfDay(new Date(a.startsAt)));
  const [start, setStart] = useState<number | null>(null);
  const slots = useSlots(db, a.professionalId, a.serviceId, day, a.id);

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-accent bg-accent-subtle/40 p-3">
      <p className="text-body-sm font-medium">Remarcar para</p>
      <Field label="Data">
        <input
          type="date"
          value={format(day, "yyyy-MM-dd")}
          min={format(new Date(), "yyyy-MM-dd")}
          onChange={(e) => { if (e.target.value) { setDay(startOfDay(new Date(`${e.target.value}T00:00`))); setStart(null); } }}
          className="h-11 w-full rounded-sm border border-line-strong bg-surface px-3 text-body shadow-xs"
        />
      </Field>
      <div role="radiogroup" aria-label="Horários livres" className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
        {slots.length === 0 && <p className="text-body-sm text-ink-2">Sem horários livres neste dia.</p>}
        {slots.map((s) => (
          <button
            key={+s}
            role="radio"
            aria-checked={start === +s}
            onClick={() => setStart(+s)}
            className={cn("tabular h-10 rounded-sm border px-3 text-body-sm font-medium", start === +s ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface hover:bg-muted")}
          >
            {time(s)}
          </button>
        ))}
      </div>
      {start && (
        <p className="text-body-sm text-ink-2">
          De <strong className="font-medium text-ink">{dayLabel(a.startsAt)}, {time(a.startsAt)}</strong> para{" "}
          <strong className="font-medium text-ink">{dayLabel(new Date(start))}, {time(new Date(start))}</strong>
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Voltar
        </Button>
        <Button
          size="sm"
          disabled={!start}
          onClick={() => {
            const prev = { ...a };
            const res = actions.reschedule(a.id, new Date(start!));
            if (!res.ok) return toast({ message: res.error, tone: "danger" });
            toast({ message: "Agendamento remarcado.", tone: "success", action: { label: "Desfazer", onClick: () => actions.restore(prev) } });
            onDone();
          }}
        >
          Confirmar remarcação
        </Button>
      </div>
    </div>
  );
}
