/**
 * Regras puras de disponibilidade (RN-10 a RN-13, RN-20, RN-22).
 * Sem dependência de banco ou de React: reaproveitadas na Fase 5 no servidor.
 * No sistema real, o conflito também é garantido pela restrição `no_overlap` no PostgreSQL.
 */
import { addMinutes, startOfDay } from "date-fns";
import type { Appointment, AppointmentStatus, AvailabilityRule, ScheduleBlock } from "@/prototype/types";

export const BLOCKING_STATUSES: AppointmentStatus[] = ["requested", "confirmed"];

export function isBlocking(status: AppointmentStatus) {
  return BLOCKING_STATUSES.includes(status);
}

/** Intervalos meio-abertos [início, fim): encostar não é conflito. */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  requested: ["confirmed", "declined", "expired", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  declined: [],
  expired: [],
  cancelled: [],
  no_show: [],
  completed: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return TRANSITIONS[from].includes(to);
}

function atTime(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = startOfDay(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export interface SlotQuery {
  day: Date;
  professionalId: string;
  durationMin: number;
  bufferAfterMin: number;
  stepMin: number;
  rules: AvailabilityRule[];
  blocks: ScheduleBlock[];
  appointments: Appointment[];
  /** Horários antes deste instante não são oferecidos (antecedência mínima). */
  notBefore?: Date;
  /** Ignora este agendamento (remarcação do próprio). */
  ignoreAppointmentId?: string;
}

/** Janelas de trabalho do profissional no dia, antes de descontar ocupações. */
export function workWindows(day: Date, professionalId: string, rules: AvailabilityRule[]) {
  return rules
    .filter((r) => r.professionalId === professionalId && r.weekday === day.getDay())
    .map((r) => ({ start: atTime(day, r.start), end: atTime(day, r.end) }))
    .sort((a, b) => +a.start - +b.start);
}

/** Inícios possíveis em que `duração + buffer` cabem inteiros numa janela livre (RN-11). */
export function freeSlots(q: SlotQuery): Date[] {
  const total = q.durationMin + q.bufferAfterMin;
  const busy = [
    ...q.blocks
      .filter((b) => b.professionalId === null || b.professionalId === q.professionalId)
      .map((b) => ({ start: new Date(b.startsAt), end: new Date(b.endsAt) })),
    ...q.appointments
      .filter((a) => a.professionalId === q.professionalId && isBlocking(a.status) && a.id !== q.ignoreAppointmentId)
      .map((a) => ({ start: new Date(a.startsAt), end: new Date(a.endsAt) })),
  ];

  const out: Date[] = [];
  for (const w of workWindows(q.day, q.professionalId, q.rules)) {
    for (let s = w.start; addMinutes(s, total) <= w.end; s = addMinutes(s, q.stepMin)) {
      const e = addMinutes(s, total);
      if (q.notBefore && s < q.notBefore) continue;
      if (busy.some((b) => overlaps(s, e, b.start, b.end))) continue;
      out.push(s);
    }
  }
  return out;
}

/** Verifica se um intervalo específico está livre (usado ao salvar). */
export function hasConflict(
  appointments: Appointment[],
  professionalId: string,
  start: Date,
  end: Date,
  ignoreId?: string,
) {
  return appointments.some(
    (a) =>
      a.id !== ignoreId &&
      a.professionalId === professionalId &&
      isBlocking(a.status) &&
      overlaps(start, end, new Date(a.startsAt), new Date(a.endsAt)),
  );
}

/** Reserva temporária: min(agora + prazo, início − antecedência mínima) (RN-32). */
export function holdExpiry(now: Date, start: Date, holdHours: number, minLeadHours: number) {
  const byDeadline = addMinutes(now, holdHours * 60);
  const byLead = addMinutes(start, -minLeadHours * 60);
  return byDeadline < byLead ? byDeadline : byLead;
}
