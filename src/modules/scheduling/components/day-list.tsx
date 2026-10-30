"use client";

import { addDays, isSameDay, startOfDay } from "date-fns";
import { CalendarDays, Clock } from "lucide-react";
import { freeSlots } from "@/modules/availability/rules";
import { select } from "@/modules/clinic/client";
import type { Appointment, Db } from "@/prototype/types";
import { StatusBadge } from "@/ui/status-badge";
import { EmptyState } from "@/ui/primitives";
import { fmt, time } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Visão do celular: faixa de dias + lista do dia + horários livres (docs/05 §1). */
export function DayList({
  db, day, professionalIds, appointments, onDay, onOpen, onSlot,
}: {
  db: Db;
  day: Date;
  professionalIds: string[];
  appointments: Appointment[];
  onDay: (d: Date) => void;
  onOpen: (id: string) => void;
  onSlot: (professionalId: string, start: Date) => void;
}) {
  const strip = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i - 1));
  const list = appointments.filter((a) => isSameDay(new Date(a.startsAt), day)).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1" role="listbox" aria-label="Escolher dia">
        {strip.map((d) => {
          const selected = isSameDay(d, day);
          return (
            <button
              key={+d}
              role="option"
              aria-selected={selected}
              onClick={() => onDay(d)}
              className={cn(
                "flex h-16 w-14 shrink-0 snap-start flex-col items-center justify-center rounded-md border text-body-sm",
                selected ? "border-accent bg-accent text-on-accent" : "border-line bg-surface",
              )}
            >
              <span className={cn("text-caption capitalize", !selected && "text-ink-2")}>{fmt(d, "EEE")}</span>
              <span className="tabular text-headline font-semibold">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <section aria-label="Agendamentos do dia" className="overflow-hidden rounded-md border border-line bg-surface">
        {list.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nenhum agendamento" description="Escolha um horário livre abaixo para agendar." className="py-8" />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((a) => {
              const prof = select.professional(db, a.professionalId);
              const canSee = select.canSeeDetails(db, a);
              return (
                <li key={a.id}>
                  <button onClick={() => onOpen(a.id)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas", a.status === "requested" && "stripes-pending")}>
                    <span className="tabular w-11 text-body-sm font-semibold">{time(a.startsAt)}</span>
                    <span className="h-10 w-1 rounded-full" style={{ background: `var(--agenda-${prof.color})` }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{canSee ? select.personName(db, a) : "Ocupado"}</span>
                      <span className="block truncate text-body-sm text-ink-2">
                        {canSee ? `${select.service(db, a.serviceId).name} · ${prof.name}` : prof.name}
                      </span>
                    </span>
                    <StatusBadge status={a.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="livres" className="rounded-md border border-line bg-surface p-4">
        <h2 id="livres" className="mb-3 flex items-center gap-2 text-headline font-semibold">
          <Clock className="size-4 text-ink-2" aria-hidden /> Horários livres
        </h2>
        <div className="flex flex-col gap-4">
          {professionalIds.map((pid) => {
            const prof = select.professional(db, pid);
            const slots = freeSlots({
              day, professionalId: pid, durationMin: 30, bufferAfterMin: 0, stepMin: 30,
              rules: db.availability, blocks: db.blocks, appointments: db.appointments, notBefore: new Date(),
            });
            return (
              <div key={pid}>
                <p className="mb-2 flex items-center gap-2 text-body-sm font-medium">
                  <span className="size-2 rounded-full" style={{ background: `var(--agenda-${prof.color})` }} aria-hidden />
                  {prof.name}
                </p>
                {slots.length === 0 ? (
                  <p className="text-body-sm text-ink-3">Sem horários livres neste dia.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <button
                        key={+s}
                        onClick={() => onSlot(pid, s)}
                        aria-label={`Agendar às ${time(s)} com ${prof.name}`}
                        className="tabular h-11 rounded-sm border border-line-strong px-3 text-body-sm font-medium hover:border-accent hover:bg-accent-subtle"
                      >
                        {time(s)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
