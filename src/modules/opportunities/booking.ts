import { addDays, startOfDay } from "date-fns";
import { freeSlots } from "@/modules/availability/rules";
import type { Db, OpportunityItem } from "@/prototype/types";

/*
 * Do cartão para a agenda: acha o primeiro horário agendável (mesma regra da tela de agendamento,
 * passos de 15 min) e monta o link com tudo preenchido. Nada é agendado aqui: a pessoa confirma
 * no painel da agenda, e o banco confere conflito e horário de atendimento.
 */

export function firstBookableSlot(db: Db, professionalId: string, serviceId: string, from: Date, until?: Date): Date | null {
  const svc = db.services.find((s) => s.id === serviceId);
  if (!svc) return null;
  const now = new Date();
  const start = from > now ? from : now;
  for (let d = 0; d < 31; d++) {
    const day = addDays(startOfDay(start), d);
    if (until && day >= until) return null;
    const slot = freeSlots({
      day, professionalId, durationMin: svc.durationMin, bufferAfterMin: svc.bufferAfterMin, stepMin: 15,
      rules: db.availability, blocks: db.blocks, appointments: db.appointments, notBefore: start,
    }).find((s) => !until || s < until);
    if (slot) return slot;
  }
  return null;
}

export interface BookingLink {
  professionalId: string;
  start?: Date | null;
  serviceId?: string | null;
  patientId?: string | null;
  opportunityId?: string;
  waitingEntryId?: string;
}

export function bookingHref(org: string, b: BookingLink): string {
  const q = new URLSearchParams({ novo: "1", profissional: b.professionalId });
  if (b.start) q.set("inicio", b.start.toISOString());
  if (b.serviceId) q.set("servico", b.serviceId);
  if (b.patientId) q.set("paciente", b.patientId);
  if (b.opportunityId) q.set("oportunidade", b.opportunityId);
  if (b.waitingEntryId) q.set("espera", b.waitingEntryId);
  return `/c/${org}/agenda?${q.toString()}`;
}

/** Link "Agendar" de cada tipo de oportunidade (null quando não há o que agendar). */
export function opportunityBooking(db: Db, item: OpportunityItem): BookingLink | null {
  if (!item.professional_id || item.status === "resolved" || item.status === "dismissed" || item.status === "expired") return null;
  const professional = db.professionals.find((p) => p.id === item.professional_id && p.active);
  if (!professional) return null;
  const offered = db.services.filter((s) => s.active && s.professionalIds.includes(professional.id));
  const serviceId = offered.find((s) => s.id === item.service_id)?.id ?? offered[0]?.id;
  if (!serviceId) return null;
  const from = item.window_start && (item.kind === "free_slots" || item.kind === "cancelled_slot") ? new Date(item.window_start) : new Date();
  const until = item.kind === "cancelled_slot" && item.window_end ? new Date(item.window_end) : undefined;
  return {
    professionalId: professional.id,
    start: firstBookableSlot(db, professional.id, serviceId, from, until),
    serviceId,
    patientId: item.kind === "free_slots" || item.kind === "cancelled_slot" ? null : item.patient_id,
    opportunityId: item.id,
  };
}
