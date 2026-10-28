"use client";

import { addDays, endOfMonth, endOfWeek, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { select } from "@/prototype/store";
import type { Appointment, Db } from "@/prototype/types";
import { fmt, time } from "@/lib/format";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export function MonthView({ db, anchor, appointments, onPickDay }: { db: Db; anchor: Date; appointments: Appointment[]; onPickDay: (d: Date) => void }) {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface shadow-xs">
      <div className="grid grid-cols-7 border-b border-line bg-canvas" aria-hidden>
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-caption font-semibold text-ink-2 uppercase">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = appointments.filter((a) => isSameDay(new Date(a.startsAt), d)).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
          const pending = list.filter((a) => a.status === "requested").length;
          const today = isSameDay(d, new Date());
          return (
            <button
              key={+d}
              onClick={() => onPickDay(d)}
              aria-label={`${fmt(d, "EEEE, d 'de' MMMM")}: ${list.length} agendamentos${pending ? `, ${pending} aguardando aprovação` : ""}. Abrir dia.`}
              className={cn(
                "flex min-h-20 flex-col gap-1 border-r border-b border-line p-1.5 text-left transition-colors hover:bg-canvas sm:min-h-28 sm:p-2 [&:nth-child(7n)]:border-r-0",
                !isSameMonth(d, anchor) && "bg-canvas/60 text-ink-3",
              )}
            >
              <span className={cn("tabular grid size-7 place-items-center rounded-full text-body-sm font-medium", today && "bg-accent text-on-accent")}>{d.getDate()}</span>
              <span className="hidden flex-col gap-0.5 sm:flex">
                {list.slice(0, 3).map((a) => (
                  <span key={a.id} className="flex items-center gap-1 truncate text-caption">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--agenda-${select.professional(db, a.professionalId).color})` }} aria-hidden />
                    <span className="tabular text-ink-2">{time(a.startsAt)}</span>
                    <span className="truncate">{select.canSeeDetails(db, a) ? select.personName(db, a).split(" ")[0] : "Ocupado"}</span>
                  </span>
                ))}
                {list.length > 3 && <span className="text-caption text-ink-3">+{list.length - 3} mais</span>}
              </span>
              {list.length > 0 && (
                <span className="tabular text-caption text-ink-2 sm:hidden" aria-hidden>
                  {list.length}
                </span>
              )}
              {pending > 0 && (
                <span className="mt-auto inline-flex w-fit items-center rounded-xs bg-warning-subtle px-1 text-[11px] font-medium text-warning" aria-hidden>
                  {pending} aguard.
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
