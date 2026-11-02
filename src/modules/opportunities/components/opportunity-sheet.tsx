"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { CalendarPlus, Check, Copy, History, Info, ListChecks, Phone, UserRound } from "lucide-react";
import { select } from "@/modules/clinic/client";
import type { ContactOutcome, Db, OpportunityAction, OpportunityDetail, OpportunityItem } from "@/prototype/types";
import { Sheet } from "@/ui/sheet";
import { Button } from "@/ui/button";
import { Field, Input, Select, Textarea } from "@/ui/field";
import { Skeleton } from "@/ui/primitives";
import { useToast } from "@/ui/toast";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import { dayLabel, fmt, phone, time } from "@/lib/format";
import { cn } from "@/lib/cn";
import { assignOpportunity, getOpportunityDetail, logContact, setOpportunityStatus } from "../actions";
import { bookingHref, firstBookableSlot, opportunityBooking } from "../booking";
import { KIND_META, OUTCOME_LABEL, PERIOD_LABEL, STATUS_LABEL, WEEKDAY_SHORT, describe, explainValue, valueLabel } from "../labels";
import { PriorityBadge, namesFor, primaryLink, secondaryLink } from "./opportunity-card";

export interface TeamMember {
  userId: string;
  name: string;
  active: boolean;
}

export function OpportunitySheet({
  db, org, item, mode, team, canWork, onClose,
}: {
  db: Db;
  org: string;
  item: OpportunityItem | null;
  mode: "view" | "contact";
  team: TeamMember[];
  canWork: boolean;
  onClose: () => void;
}) {
  const text = item ? describe(item, namesFor(db, item)) : null;
  return (
    <Sheet open={item !== null} onOpenChange={(o) => !o && onClose()} title={text?.title ?? ""} description={text?.context || undefined}>
      {item && <Body key={item.id} db={db} org={org} item={item} mode={mode} team={team} canWork={canWork} />}
    </Sheet>
  );
}

function Body({ db, org, item, mode, team, canWork }: { db: Db; org: string; item: OpportunityItem; mode: "view" | "contact"; team: TeamMember[]; canWork: boolean }) {
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [error, setError] = useState<string>();
  const [, startLoading] = useTransition();
  const load = useCallback(
    () =>
      startLoading(async () => {
        const r = await getOpportunityDetail(org, item.id);
        if (r.ok && r.data) {
          setDetail(r.data);
          setError(undefined);
        } else setError(r.message ?? "Não foi possível carregar os detalhes.");
      }),
    [org, item.id],
  );
  useEffect(load, [load]);

  const open = item.status === "new" || item.status === "in_progress";
  const patient = select.patient(db, item.patient_id);
  const value = valueLabel(item);
  const booking = open && canWork ? opportunityBooking(db, item) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 text-caption">
        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-accent-subtle px-2.5 font-medium text-accent">
          {KIND_META[item.kind].label}
        </span>
        {open && <PriorityBadge priority={item.priority} />}
        <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 font-medium text-ink-2">{STATUS_LABEL[item.status]}</span>
        {value && <span className="tabular ml-auto text-body-sm font-semibold">{value}</span>}
      </div>

      {patient && (
        <section aria-label="Paciente" className="flex items-center justify-between gap-3 rounded-sm bg-canvas p-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{patient.name}</p>
            {patient.phone && (
              <p className="tabular flex items-center gap-1.5 text-body-sm text-ink-2">
                <Phone className="size-3.5" aria-hidden /> {phone(patient.phone)}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            {patient.phone && <CopyPhone value={phone(patient.phone)} />}
            <Link href={`/c/${org}/pacientes?id=${patient.id}`} className="inline-flex h-9 items-center rounded-full px-3 text-body-sm font-medium text-accent hover:bg-accent-subtle">
              Abrir cadastro
            </Link>
          </div>
        </section>
      )}

      {booking && (
        <Link href={bookingHref(org, booking)} className={cn(primaryLink, "self-start")}>
          <CalendarPlus className="size-4" aria-hidden />
          {booking.start ? `Agendar · ${dayLabel(booking.start)}, ${time(booking.start)}` : "Agendar"}
        </Link>
      )}

      {error && <FormNotice tone="danger">{error}</FormNotice>}
      {!detail && !error && (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando detalhes">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {detail && (item.kind === "free_slots" || item.kind === "cancelled_slot") && detail.free_ranges.length > 0 && (
        <section>
          <h3 className="mb-2 text-caption font-semibold text-ink-2">{item.kind === "free_slots" ? "Trechos livres" : "Horário liberado"}</h3>
          <p className="tabular text-body-sm">
            {item.window_start && `${dayLabel(item.window_start)}: `}
            {detail.free_ranges.map((r) => `${time(r.start)}–${time(r.end)}`).join(", ")}
          </p>
        </section>
      )}

      {detail && (item.kind === "free_slots" || item.kind === "cancelled_slot") && open && (
        <Matches db={db} org={org} item={item} detail={detail} canWork={canWork} />
      )}

      {detail && (
        <details className="rounded-sm border border-line p-3 text-body-sm">
          <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
            <Info className="size-4 text-ink-2" aria-hidden /> Como calculamos
          </summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-ink-2">
            {explainValue({ ...item, basis: detail.basis ?? item.basis, value_cents: detail.value_cents ?? item.value_cents }).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      )}

      {open && canWork && <WorkActions org={org} item={item} mode={mode} team={team} onDone={load} />}

      {detail && <HistoryList actions={detail.actions} />}
    </div>
  );
}

function CopyPhone({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span>{copied ? "Copiado" : "Copiar telefone"}</span>
    </Button>
  );
}

/** Lista de espera compatível com o horário: sugestão para contato manual, nunca agenda sozinho. */
function Matches({ db, org, item, detail, canWork }: { db: Db; org: string; item: OpportunityItem; detail: OpportunityDetail; canWork: boolean }) {
  const until = item.kind === "cancelled_slot" && item.window_end ? new Date(item.window_end) : undefined;
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-caption font-semibold text-ink-2">
        <ListChecks className="size-3.5" aria-hidden /> Lista de espera compatível
      </h3>
      {detail.matches.length === 0 ? (
        <p className="text-body-sm text-ink-2">
          Ninguém da lista de espera combina com este horário.{" "}
          <Link href={`/c/${org}/inicio/oportunidades/espera`} className="font-medium text-accent underline-offset-2 hover:underline">
            Ver lista de espera
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-sm border border-line">
          {detail.matches.map((m) => {
            const patient = select.patient(db, m.patient_id);
            const entry = db.waitingList.find((w) => w.id === m.entry_id);
            const start = item.professional_id ? firstBookableSlot(db, item.professional_id, m.service_id, new Date(m.starts_at), until) : null;
            const prefs = [
              entry?.periods?.map((p) => PERIOD_LABEL[p]).join(", "),
              entry?.weekdays?.map((d) => WEEKDAY_SHORT[d]).join(", "),
            ].filter(Boolean).join(" · ");
            return (
              <li key={m.entry_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-body-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{patient?.name ?? "Paciente"}</span>
                  <span className="block text-caption text-ink-2">
                    {select.service(db, m.service_id).name}
                    {prefs && ` · prefere ${prefs.toLowerCase()}`}
                    {patient?.phone && ` · ${phone(patient.phone)}`}
                  </span>
                </span>
                {canWork && item.professional_id && start && (
                  <Link
                    href={bookingHref(org, {
                      professionalId: item.professional_id, start, serviceId: m.service_id, patientId: m.patient_id,
                      opportunityId: item.id, waitingEntryId: m.entry_id,
                    })}
                    className={secondaryLink}
                  >
                    Agendar às {time(start)}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const OUTCOMES = Object.entries(OUTCOME_LABEL) as [ContactOutcome, string][];

function WorkActions({ org, item, mode, team, onDone }: { org: string; item: OpportunityItem; mode: "view" | "contact"; team: TeamMember[]; onDone: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<ContactOutcome | "">("");
  const [note, setNote] = useState("");
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.message ?? "Não foi possível concluir.");
      setError(undefined);
      toast({ message: ok, tone: "success" });
      onDone();
    });

  return (
    <section aria-label="Ações" className="flex flex-col gap-4 rounded-sm border border-line p-3">
      {error && <FormNotice tone="danger">{error}</FormNotice>}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!outcome) return setError("Escolha o resultado do contato.");
          run(async () => {
            const r = await logContact(org, { id: item.id, outcome, note });
            if (r.ok) {
              setOutcome("");
              setNote("");
            }
            return r;
          }, "Contato registrado.");
        }}
      >
        <fieldset>
          <legend className="mb-2 text-body-sm font-medium">Registrar tentativa de contato</legend>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map(([v, l]) => (
              <label
                key={v}
                className={cn(
                  "inline-flex h-9 cursor-pointer items-center rounded-full border px-3 text-body-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                  outcome === v ? "border-accent bg-accent-subtle text-accent" : "border-line-strong",
                )}
              >
                <input type="radio" name={`outcome-${item.id}`} value={v} checked={outcome === v} onChange={() => setOutcome(v)} className="sr-only" autoFocus={mode === "contact" && v === OUTCOMES[0][0]} />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Observação" optional hint="Só o combinado (ex.: “ligar à tarde”). Não registre informações clínicas.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} className="min-h-16" />
        </Field>
        <Button type="submit" variant="secondary" loading={pending} className="self-start">
          Registrar contato
        </Button>
      </form>

      <Field label="Responsável">
        <Select
          value={item.assigned_to ?? ""}
          disabled={pending}
          onChange={(e) => {
            const userId = e.target.value;
            run(() => assignOpportunity(org, { id: item.id, userId }), userId ? "Responsável definido." : "Responsável removido.");
          }}
        >
          <option value="">Sem responsável</option>
          {team.filter((m) => m.active || m.userId === item.assigned_to).map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>

      {dismissing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length < 3) return setError("Informe o motivo do descarte.");
            run(() => setOpportunityStatus(org, { id: item.id, status: "dismissed", reason }), "Oportunidade descartada.");
          }}
        >
          <Field label="Motivo do descarte" hint="Ex.: paciente mudou de cidade, horário reservado para outra finalidade.">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoFocus />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" loading={pending}>
              Descartar
            </Button>
            <Button variant="ghost" onClick={() => setDismissing(false)}>
              Voltar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={pending} onClick={() => run(() => setOpportunityStatus(org, { id: item.id, status: "resolved" }), "Marcada como resolvida.")}>
            <Check className="size-4" aria-hidden /> Marcar como resolvida
          </Button>
          <Button variant="ghost" onClick={() => setDismissing(true)}>
            Descartar
          </Button>
        </div>
      )}
    </section>
  );
}

function actionText(a: OpportunityAction): string {
  switch (a.kind) {
    case "detected":
      return "Identificada pelo sistema";
    case "reopened":
      return "Reaberta pelo sistema: a situação voltou";
    case "contact":
      return `Contato: ${a.outcome ? OUTCOME_LABEL[a.outcome] : "registrado"}`;
    case "assigned":
      return a.assigned ? `Responsável: ${a.assigned}` : "Responsável removido";
    case "status":
      return a.to ? STATUS_LABEL[a.to] : "Status alterado";
    case "booked":
      return "Agendamento feito";
    case "resolved_auto":
      return "Resolvida automaticamente: a situação deixou de existir";
    case "expired":
      return "Expirada: o prazo passou";
  }
}

function HistoryList({ actions }: { actions: OpportunityAction[] }) {
  if (actions.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-caption font-semibold text-ink-2">
        <History className="size-3.5" aria-hidden /> Histórico
      </h3>
      <ol className="flex flex-col gap-1.5 border-l border-line pl-3 text-caption text-ink-2">
        {[...actions].reverse().map((a, i) => (
          <li key={i}>
            <span className="font-medium text-ink">{actionText(a)}</span>
            {" · "}
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3" aria-hidden /> {a.actor ?? "Sistema"}
            </span>
            {" · "}
            <time dateTime={a.at}>{fmt(a.at, "dd/MM HH:mm")}</time>
            {a.note && <span className="block text-ink-2">“{a.note}”</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
