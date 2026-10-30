"use client";

import { addMinutes, differenceInMinutes, isSameDay, startOfDay } from "date-fns";
import { Check, Clock, UserX } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { hasConflict, overlaps, workWindows } from "@/modules/availability/rules";
import { select } from "@/modules/clinic/client";
import type { Appointment, Db } from "@/prototype/types";
import { fmt, time } from "@/lib/format";
import { cn } from "@/lib/cn";

export const DAY_START = 7;
export const DAY_END = 20;
const HOUR_PX = 64;
const PX_PER_MIN = HOUR_PX / 60;
const SLOT_MIN = 30;

export interface GridColumn {
  key: string;
  label: string;
  sublabel?: string;
  day: Date;
  highlight?: boolean;
  lanes: string[]; // ids de profissionais
}

interface TimeGridProps {
  db: Db;
  columns: GridColumn[];
  appointments: Appointment[];
  onSlot: (professionalId: string, start: Date) => void;
  onOpen: (id: string) => void;
}

/**
 * Grade de tempo usada nas visões Dia (colunas = profissionais) e Semana (colunas = dias,
 * com uma faixa por profissional). Horários livres são botões com navegação por setas
 * (tabindex itinerante), para não obrigar a tabular por centenas de células.
 */
export function TimeGrid({ db, columns, appointments, onSlot, onOpen }: TimeGridProps) {
  const now = useNow();
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const height = (DAY_END - DAY_START) * HOUR_PX;
  const [focusKey, setFocusKey] = useState<string | null>(null);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const el = e.currentTarget;
    const c = Number(el.dataset.c);
    const r = Number(el.dataset.r);
    const delta: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const grid = el.closest("[data-grid]")!;
    // Procura a próxima célula livre na direção pedida.
    for (let step = 1; step < 60; step++) {
      const target = grid.querySelector<HTMLButtonElement>(`[data-c="${c + d[0] * step}"][data-r="${r + d[1] * step}"]`);
      if (target) {
        setFocusKey(target.dataset.k!);
        target.focus();
        return;
      }
      if (d[0] !== 0 && !grid.querySelector(`[data-c="${c + d[0] * step}"]`)) return;
    }
  }

  // Pré-cálculo das faixas: índice de coluna para navegação e células livres futuras.
  const lanes = columns.flatMap((col) => col.lanes.map((pid) => ({ col, pid })));
  const laneData = lanes.map(({ col, pid }, c) => {
    const windows = workWindows(col.day, pid, db.availability);
    const slots = windows.flatMap((w) => {
      const out: { k: string; r: number; start: Date }[] = [];
      for (let s = w.start; s < w.end; s = addMinutes(s, SLOT_MIN)) {
        const r = (minutesFromStart(s) / SLOT_MIN) | 0;
        // Só células realmente livres: futuras e sem agendamento ou bloqueio sobreposto.
        const e = addMinutes(s, SLOT_MIN);
        const blocked = db.blocks.some(
          (b) => (b.professionalId === null || b.professionalId === pid) && overlaps(s, e, new Date(b.startsAt), new Date(b.endsAt)),
        );
        if (s >= now && !blocked && !hasConflict(db.appointments, pid, s, e)) out.push({ k: `${c}-${r}`, r, start: s });
      }
      return out;
    });
    return { key: `${col.key}:${pid}`, c, windows, slots };
  });
  const firstSlotKey = laneData.find((l) => l.slots.length)?.slots[0].k ?? null;
  const lane = (col: GridColumn, pid: string) => laneData.find((l) => l.key === `${col.key}:${pid}`)!;

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface shadow-xs">
      <div className="min-w-[600px]" data-grid>
        {/* Cabeçalho das colunas (vidro ao rolar) */}
        <div className="glass sticky top-0 z-10 flex border-b border-line">
          <div className="w-14 shrink-0" />
          {columns.map((col) => (
            <div key={col.key} className={cn("flex-1 border-l border-line px-2 py-2.5 text-center", col.highlight && "text-accent")}>
              <div className="truncate text-body-sm font-semibold capitalize">{col.label}</div>
              {col.sublabel && <div className="truncate text-caption text-ink-2">{col.sublabel}</div>}
              {col.lanes.length > 1 && (
                <div className="mt-1.5 flex justify-center gap-1" aria-hidden>
                  {col.lanes.map((pid) => (
                    <span key={pid} className="h-1 flex-1 rounded-full" style={{ background: `var(--agenda-${select.professional(db, pid).color})` }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex">
          {/* Eixo de horas */}
          <div className="relative w-14 shrink-0" style={{ height }} aria-hidden>
            {hours.map((h) => (
              <div key={h} className="tabular absolute right-2 -translate-y-2 text-caption text-ink-3" style={{ top: (h - DAY_START) * HOUR_PX }}>
                {h > DAY_START && `${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {columns.map((col) => (
            <div key={col.key} className="relative flex flex-1 border-l border-line" style={{ height }}>
              {/* Linhas de hora */}
              {hours.map((h) => (
                <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ top: (h - DAY_START) * HOUR_PX }} aria-hidden />
              ))}
              {col.lanes.map((pid) => {
                const { c, windows, slots } = lane(col, pid);
                const laneAppts = appointments.filter((a) => a.professionalId === pid && isSameDay(new Date(a.startsAt), col.day));
                const prof = select.professional(db, pid);
                return (
                  <div key={pid} className="relative flex-1 border-l border-dashed border-line first:border-l-0">
                    {/* Fora do expediente: listrado neutro */}
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,var(--color-bg-subtle)_0_6px,var(--color-bg-muted)_6px_7px)]" aria-hidden />
                    {windows.map((w) => (
                      <div
                        key={+w.start}
                        className="absolute inset-x-0 bg-surface"
                        style={{ top: minutesFromStart(w.start) * PX_PER_MIN, height: differenceInMinutes(w.end, w.start) * PX_PER_MIN }}
                        aria-hidden
                      />
                    ))}
                    {/* Horários clicáveis */}
                    {slots.map(({ k, r, start: s }) => (
                      <button
                        key={k}
                        data-k={k}
                        data-c={c}
                        data-r={r}
                        tabIndex={(focusKey ?? firstSlotKey) === k ? 0 : -1}
                        onFocus={() => setFocusKey(k)}
                        onKeyDown={onKeyDown}
                        onClick={() => onSlot(pid, s)}
                        aria-label={`${fmt(s, "EEEE, d 'de' MMMM")}, ${time(s)}, ${prof.name}: horário livre. Agendar.`}
                        className="group absolute inset-x-0.5 scroll-mt-24 rounded-xs outline-none hover:bg-accent-subtle focus-visible:bg-accent-subtle focus-visible:ring-2 focus-visible:ring-accent"
                        style={{ top: minutesFromStart(s) * PX_PER_MIN + 1, height: SLOT_MIN * PX_PER_MIN - 2 }}
                      >
                        <span className="tabular hidden px-1.5 text-caption font-medium text-accent group-hover:block group-focus-visible:block">+ {time(s)}</span>
                      </button>
                    ))}
                    {/* Agendamentos */}
                    {laneAppts.map((a) => (
                      <Block key={a.id} db={db} a={a} compact={col.lanes.length > 1} onOpen={onOpen} />
                    ))}
                  </div>
                );
              })}
              {/* Agora */}
              {isSameDay(col.day, now) && now.getHours() >= DAY_START && now.getHours() < DAY_END && (
                <div className="pointer-events-none absolute inset-x-0 z-[5] h-0.5 bg-danger" style={{ top: minutesFromStart(now) * PX_PER_MIN }} aria-hidden>
                  <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-danger" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Block({ db, a, compact, onOpen }: { db: Db; a: Appointment; compact: boolean; onOpen: (id: string) => void }) {
  const prof = select.professional(db, a.professionalId);
  const svc = select.service(db, a.serviceId);
  const start = new Date(a.startsAt);
  const minutes = differenceInMinutes(new Date(a.endsAt), start);
  const canSee = select.canSeeDetails(db, a);
  const name = canSee ? select.personName(db, a) : "Ocupado";
  // Serviço também revela informação de saúde: só aparece para quem pode ver os detalhes (C5, D-06).
  const service = canSee ? svc.name : null;
  const short = minutes < 40;

  return (
    <button
      onClick={() => onOpen(a.id)}
      aria-label={`${time(a.startsAt)}, ${name}${service ? `, ${service}` : ""}, ${prof.name}. Status: ${labelFor(a.status)}. Abrir detalhes.`}
      className={cn(
        "absolute inset-x-0.5 z-[2] overflow-hidden rounded-sm border-l-[3px] px-1.5 py-1 text-left text-caption shadow-xs transition-shadow hover:shadow-md",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
        a.status === "requested" && "stripes-pending border border-l-[3px] border-dashed",
        a.status === "completed" && "saturate-50 [&_span]:text-ink-2",
        a.status === "no_show" && "border border-l-[3px] border-dashed border-danger",
        a.status === "cancelled" && "line-through [&_span]:text-ink-2",
      )}
      style={{
        top: minutesFromStart(start) * PX_PER_MIN + 1,
        height: Math.max(minutes * PX_PER_MIN - 2, 20),
        borderColor: a.status === "requested" ? "var(--color-warning)" : undefined,
        borderLeftColor: `var(--agenda-${prof.color})`,
        backgroundColor: a.status === "requested" ? "var(--color-warning-subtle)" : `var(--agenda-${prof.color}-bg)`,
      }}
    >
      <span className={cn("flex items-center gap-1 font-semibold text-ink", short && "truncate")}>
        {a.status === "requested" && <Clock className="size-3 shrink-0 text-warning" aria-hidden />}
        {a.status === "no_show" && <UserX className="size-3 shrink-0 text-danger" aria-hidden />}
        {a.status === "completed" && <Check className="size-3 shrink-0 text-success" aria-hidden />}
        <span className="truncate">{compact && short ? name.split(" ")[0] : name}</span>
      </span>
      {!short && (
        <>
          <span className="tabular block truncate text-ink-2">
            {time(a.startsAt)}{service && ` · ${service}`}
          </span>
          {a.status === "requested" && <span className="block font-medium text-warning">Aguardando</span>}
        </>
      )}
    </button>
  );
}

const labelFor = (s: Appointment["status"]) =>
  ({ requested: "aguardando aprovação", confirmed: "confirmado", completed: "concluído", no_show: "faltou", cancelled: "cancelado", declined: "recusado", expired: "expirada" })[s];

function minutesFromStart(d: Date) {
  return differenceInMinutes(d, addMinutes(startOfDay(d), DAY_START * 60));
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return now;
}
