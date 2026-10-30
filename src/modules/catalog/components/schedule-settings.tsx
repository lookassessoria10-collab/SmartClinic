"use client";

import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarOff, Clock, Copy, Plus, Trash2, X } from "lucide-react";
import { useDb } from "@/modules/clinic/client";
import { addBlock, removeBlock, saveWeeklyAvailability } from "@/modules/catalog/actions";
import { BLOCK_KINDS, type WeeklyRule } from "@/modules/catalog/schemas";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import { Card, CardHeader, EmptyState, PageHeader } from "@/ui/primitives";
import { Button } from "@/ui/button";
import { Field, Input, Select } from "@/ui/field";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { useToast } from "@/ui/toast";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Check } from "./form-bits";

const DAYS = [
  { n: 1, label: "Segunda" },
  { n: 2, label: "Terça" },
  { n: 3, label: "Quarta" },
  { n: 4, label: "Quinta" },
  { n: 5, label: "Sexta" },
  { n: 6, label: "Sábado" },
  { n: 0, label: "Domingo" },
];
const DEFAULT_DAY = [
  { start: "08:00", end: "12:00" },
  { start: "13:00", end: "18:00" },
];

export function ScheduleSettings({ writable }: { writable: boolean }) {
  const db = useDb();
  const active = db.professionals.filter((p) => p.active);
  const [proId, setProId] = useState(active[0]?.id ?? "");

  return (
    <>
      <PageHeader title="Horários" description="Quando cada profissional atende e quando a agenda fica fechada. A agenda só oferece horários dentro destas faixas." />
      {!writable && (
        <div className="mb-4">
          <FormNotice tone="info">A clínica está em modo somente leitura.</FormNotice>
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader title="Horário de atendimento" description="Semana padrão de cada profissional." icon={Clock} />
          {active.length === 0 ? (
            <EmptyState icon={Clock} title="Nenhum profissional ativo" description="Cadastre um profissional em Gestão → Profissionais." className="py-8" />
          ) : (
            <div className="flex flex-col gap-4 px-5 pb-5">
              <Field label="Profissional">
                <Select value={proId} onChange={(e) => setProId(e.target.value)}>
                  {active.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <WeekEditor key={proId} professionalId={proId} writable={writable} />
            </div>
          )}
        </Card>
        <Blocks writable={writable} />
      </div>
    </>
  );
}

type Week = Record<number, { start: string; end: string }[]>;

function WeekEditor({ professionalId, writable }: { professionalId: string; writable: boolean }) {
  const db = useDb();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [week, setWeek] = useState<Week>(() => {
    const w: Week = {};
    for (const r of db.availability.filter((x) => x.professionalId === professionalId).sort((a, b) => a.start.localeCompare(b.start))) {
      (w[r.weekday] ??= []).push({ start: r.start, end: r.end });
    }
    return w;
  });
  const empty = Object.values(week).every((d) => !d?.length);

  const setDay = (n: number, ranges: { start: string; end: string }[]) => setWeek((w) => ({ ...w, [n]: ranges }));

  return (
    <div className="flex flex-col gap-3">
      {empty && (
        <FormNotice tone="info">
          Sem horário de atendimento: a agenda deste profissional fica fechada.{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => setWeek({ 1: DEFAULT_DAY, 2: DEFAULT_DAY, 3: DEFAULT_DAY, 4: DEFAULT_DAY, 5: DEFAULT_DAY })}
          >
            Usar seg a sex, 8h–12h e 13h–18h
          </button>
        </FormNotice>
      )}
      <ul className="divide-y divide-line rounded-sm border border-line">
        {DAYS.map((d) => {
          const ranges = week[d.n] ?? [];
          return (
            <li key={d.n} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start">
              <div className="w-32 shrink-0">
                <Check checked={ranges.length > 0} onChange={(on) => setDay(d.n, on ? [{ start: "08:00", end: "18:00" }] : [])} disabled={!writable}>
                  {d.label}
                </Check>
              </div>
              <div className="flex flex-1 flex-col gap-2 py-1">
                {ranges.length === 0 && <span className="py-1.5 text-body-sm text-ink-3">Não atende</span>}
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`s-${d.n}-${i}`}>{d.label}, início da faixa {i + 1}</label>
                    <Input id={`s-${d.n}-${i}`} type="time" step={300} value={r.start} disabled={!writable} className="h-10 w-28"
                      onChange={(e) => setDay(d.n, ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                    <span className="text-ink-3" aria-hidden>–</span>
                    <label className="sr-only" htmlFor={`e-${d.n}-${i}`}>{d.label}, fim da faixa {i + 1}</label>
                    <Input id={`e-${d.n}-${i}`} type="time" step={300} value={r.end} disabled={!writable} className="h-10 w-28"
                      onChange={(e) => setDay(d.n, ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                    <Button type="button" variant="ghost" size="icon" disabled={!writable} aria-label={`Remover faixa ${i + 1} de ${d.label}`}
                      onClick={() => setDay(d.n, ranges.filter((_, j) => j !== i))}>
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
                {ranges.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" variant="ghost" size="sm" disabled={!writable || ranges.length >= 4}
                      onClick={() => setDay(d.n, [...ranges, { start: ranges.at(-1)!.end, end: "18:00" }])}>
                      <Plus className="size-3.5" aria-hidden /> Faixa
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={!writable}
                      onClick={() => setWeek((w) => ({ ...w, ...Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, ranges])) }))}>
                      <Copy className="size-3.5" aria-hidden /> Copiar para seg–sex
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <FormNotice tone="danger">{error}</FormNotice>}
      <Button
        className="self-start"
        loading={pending}
        disabled={!writable}
        onClick={() =>
          start(async () => {
            setError(undefined);
            const rules: WeeklyRule[] = Object.entries(week).flatMap(([n, rs]) => rs.map((r) => ({ weekday: Number(n), start: r.start, end: r.end })));
            const res = await saveWeeklyAvailability(org, professionalId, rules);
            if (!res.ok) return setError(res.message);
            toast({ message: "Horário de atendimento salvo.", tone: "success" });
          })
        }
      >
        Salvar horário
      </Button>
    </div>
  );
}

function Blocks({ writable }: { writable: boolean }) {
  const db = useDb();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const today = fmt(new Date(), "yyyy-MM-dd");
  const [who, setWho] = useState("");
  const [kind, setKind] = useState<(typeof BLOCK_KINDS)[number]["value"]>("holiday");
  const [allDay, setAllDay] = useState(true);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [fromTime, setFromTime] = useState("12:00");
  const [toTime, setToTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [removing, setRemoving] = useState<string | null>(null);

  const upcoming = db.blocks.filter((b) => new Date(b.endsAt) > new Date()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const kindLabel = (k: string) => BLOCK_KINDS.find((x) => x.value === k)?.label ?? k;

  return (
    <Card>
      <CardHeader title="Bloqueios" description="Feriados, férias, folgas e pausas. Nada pode ser agendado nesses períodos." icon={CalendarOff} />
      <form
        noValidate
        className="flex flex-col gap-3 border-b border-line px-5 pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          // Datas e horas no fuso do navegador (o mesmo da clínica no uso normal).
          const startsAt = new Date(`${from}T${allDay ? "00:00" : fromTime}`);
          const endsAt = allDay ? new Date(+new Date(`${to}T00:00`) + 86_400_000) : new Date(`${allDay ? to : from}T${toTime}`);
          if (Number.isNaN(+startsAt) || Number.isNaN(+endsAt)) return setError("Datas inválidas.");
          start(async () => {
            const r = await addBlock(org, { professionalId: who || null, kind, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), reason });
            if (!r.ok) return setError(r.fields?.endsAt ?? r.message);
            setError(undefined);
            setReason("");
            toast({ message: "Bloqueio adicionado.", tone: "success" });
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Para">
            <Select value={who} onChange={(e) => setWho(e.target.value)} disabled={!writable}>
              <option value="">Clínica inteira</option>
              {db.professionals.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo">
            <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} disabled={!writable}>
              {BLOCK_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Check checked={allDay} onChange={setAllDay} disabled={!writable}>
          Dia inteiro
        </Check>
        {allDay ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="De">
              <Input type="date" value={from} min={today} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} disabled={!writable} />
            </Field>
            <Field label="Até (inclusive)">
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} disabled={!writable} />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto_auto] gap-3">
            <Field label="Dia">
              <Input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} disabled={!writable} />
            </Field>
            <Field label="Das">
              <Input type="time" step={300} value={fromTime} onChange={(e) => setFromTime(e.target.value)} className="w-28" disabled={!writable} />
            </Field>
            <Field label="Às">
              <Input type="time" step={300} value={toTime} onChange={(e) => setToTime(e.target.value)} className="w-28" disabled={!writable} />
            </Field>
          </div>
        )}
        <Field label="Motivo" optional hint="Aparece para a equipe na agenda.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ex.: Feriado de Natal" disabled={!writable} />
        </Field>
        {error && <FormNotice tone="danger">{error}</FormNotice>}
        <Button type="submit" className="self-start" loading={pending} disabled={!writable}>
          <Plus className="size-4" aria-hidden /> Adicionar bloqueio
        </Button>
      </form>

      {upcoming.length === 0 ? (
        <p className="px-5 py-4 text-body-sm text-ink-3">Nenhum bloqueio programado.</p>
      ) : (
        <ul className="divide-y divide-line">
          {upcoming.map((b) => {
            const sameDay = fmt(b.startsAt, "yyyy-MM-dd") === fmt(new Date(+new Date(b.endsAt) - 1), "yyyy-MM-dd");
            const whole = fmt(b.startsAt, "HH:mm") === "00:00" && fmt(b.endsAt, "HH:mm") === "00:00";
            return (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1 text-body-sm">
                  <p className="font-medium">
                    {kindLabel(b.kind)} · {b.professionalId ? db.professionals.find((p) => p.id === b.professionalId)?.name : "Clínica inteira"}
                  </p>
                  <p className={cn("tabular text-ink-2")}>
                    {whole
                      ? sameDay
                        ? fmt(b.startsAt, "dd/MM/yyyy")
                        : `${fmt(b.startsAt, "dd/MM")} a ${fmt(new Date(+new Date(b.endsAt) - 1), "dd/MM/yyyy")}`
                      : `${fmt(b.startsAt, "dd/MM/yyyy HH:mm")} – ${fmt(b.endsAt, sameDay ? "HH:mm" : "dd/MM HH:mm")}`}
                    {b.reason && ` · ${b.reason}`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" disabled={!writable} onClick={() => setRemoving(b.id)} aria-label="Remover bloqueio">
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        destructive
        title="Remover este bloqueio?"
        description="Os horários voltam a ficar disponíveis na agenda."
        confirmLabel="Remover"
        onConfirm={() =>
          removing &&
          start(async () => {
            const r = await removeBlock(org, removing);
            toast({ message: r.ok ? "Bloqueio removido." : (r.message ?? "Não foi possível remover."), tone: r.ok ? "success" : "danger" });
          })
        }
      />
    </Card>
  );
}
