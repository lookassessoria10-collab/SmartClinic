"use client";

/**
 * Store do protótipo: estado em memória persistido no localStorage do navegador, para que
 * a página pública e a área da clínica compartilhem os mesmos dados na demonstração.
 * Simula as validações que, no sistema real, ficam no servidor e no banco (RLS, no_overlap).
 * Será substituído por Server Actions + Supabase na Fase 3.
 */
import { useSyncExternalStore } from "react";
import { addMinutes, startOfDay } from "date-fns";
import { canTransition, freeSlots, hasConflict, holdExpiry } from "@/modules/availability/rules";
import { createSeed, DB_VERSION, segmentFamily, SEGMENT_SUGGESTIONS, VIEWERS } from "./fixtures";
import type { Appointment, AppointmentStatus, Db, Need, Patient, Role, Segment } from "./types";

const KEY = "prototipo-clinicas-db";
let db: Db | null = null;
const listeners = new Set<() => void>();

function load(): Db {
  if (db) return db;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Db) : null;
    db = parsed && parsed.version === DB_VERSION ? parsed : createSeed();
  } catch {
    db = createSeed();
  }
  return expireHolds(db);
}

function commit(next: Db) {
  db = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* modo privado ou armazenamento cheio: segue só em memória */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      db = null;
      load();
      l();
    }
  };
  window.addEventListener("storage", onStorage); // sincroniza abas (público ↔ clínica)
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** `null` durante a renderização no servidor/hidratação → telas mostram skeleton. */
export function useDb(): Db | null {
  return useSyncExternalStore(subscribe, load, () => null);
}

const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 9)}`;
const nowIso = () => new Date().toISOString();

/** Solicitações vencidas liberam o horário (RN-33). No real: pg_cron + verificação na transação. */
function expireHolds(state: Db): Db {
  const now = Date.now();
  let changed = false;
  const appointments = state.appointments.map((a) => {
    if (a.status === "requested" && a.holdExpiresAt && +new Date(a.holdExpiresAt) < now) {
      changed = true;
      return { ...a, status: "expired" as const };
    }
    return a;
  });
  if (!changed) return state;
  const next = { ...state, appointments };
  db = next;
  return next;
}

function withEvent(state: Db, a: Appointment, to: AppointmentStatus, actor: string, reason?: string): Db {
  return {
    ...state,
    events: [...state.events, { appointmentId: a.id, from: a.status, to, at: nowIso(), actor, reason }],
  };
}

export type BookResult = { ok: true; id: string } | { ok: false; error: string; suggestions: Date[] };

function suggestionsFor(state: Db, professionalId: string, serviceId: string, around: Date, ignoreId?: string) {
  const svc = state.services.find((s) => s.id === serviceId)!;
  const out: Date[] = [];
  for (let d = 0; d < 7 && out.length < 3; d++) {
    const day = addMinutes(startOfDay(around), d * 1440);
    const slots = freeSlots({
      day, professionalId, durationMin: svc.durationMin, bufferAfterMin: svc.bufferAfterMin,
      stepMin: state.org.settings.slotStepMin, rules: state.availability, blocks: state.blocks,
      appointments: state.appointments, notBefore: new Date(), ignoreAppointmentId: ignoreId,
    });
    out.push(...slots.filter((s) => d > 0 || s >= around).slice(0, 3 - out.length));
  }
  return out;
}

export const actions = {
  setViewer(role: Role) {
    const s = load();
    commit({ ...s, viewer: { ...VIEWERS[role] } });
  },

  reset() {
    commit(createSeed());
  },

  createPatient(input: Omit<Patient, "id">): Patient {
    const s = load();
    const p = { ...input, id: uid("pt") };
    commit({ ...s, patients: [...s.patients, p] });
    return p;
  },

  /** Agendamento pela equipe: nasce confirmado (RN-21). */
  book(input: { professionalId: string; serviceId: string; patientId: string; startsAt: Date; notes?: string }): BookResult {
    const s = load();
    const svc = s.services.find((x) => x.id === input.serviceId)!;
    const end = addMinutes(input.startsAt, svc.durationMin + svc.bufferAfterMin);
    if (hasConflict(s.appointments, input.professionalId, input.startsAt, end)) {
      return { ok: false, error: "Esse horário acabou de ser ocupado.", suggestions: suggestionsFor(s, input.professionalId, input.serviceId, input.startsAt) };
    }
    const a: Appointment = {
      id: uid("a"), professionalId: input.professionalId, serviceId: input.serviceId, patientId: input.patientId,
      startsAt: input.startsAt.toISOString(), endsAt: end.toISOString(), status: "confirmed", origin: "staff",
      notes: input.notes, createdAt: nowIso(),
    };
    commit({
      ...s,
      appointments: [...s.appointments, a],
      events: [...s.events, { appointmentId: a.id, from: null, to: "confirmed", at: a.createdAt, actor: s.viewer.name }],
    });
    return { ok: true, id: a.id };
  },

  /** Remarcação (RN-24): mesmo registro, mesma validação de conflito. */
  reschedule(id: string, startsAt: Date, professionalId?: string): BookResult {
    const s = load();
    const a = s.appointments.find((x) => x.id === id)!;
    const svc = s.services.find((x) => x.id === a.serviceId)!;
    const prof = professionalId ?? a.professionalId;
    const end = addMinutes(startsAt, svc.durationMin + svc.bufferAfterMin);
    if (hasConflict(s.appointments, prof, startsAt, end, id)) {
      return { ok: false, error: "Esse horário já está ocupado.", suggestions: suggestionsFor(s, prof, a.serviceId, startsAt, id) };
    }
    commit({
      ...s,
      appointments: s.appointments.map((x) => (x.id === id ? { ...x, professionalId: prof, startsAt: startsAt.toISOString(), endsAt: end.toISOString() } : x)),
    });
    return { ok: true, id };
  },

  setStatus(id: string, to: AppointmentStatus, reason?: string): boolean {
    const s = load();
    const a = s.appointments.find((x) => x.id === id);
    if (!a || !canTransition(a.status, to)) return false;
    commit(withEvent({ ...s, appointments: s.appointments.map((x) => (x.id === id ? { ...x, status: to } : x)) }, a, to, s.viewer.name, reason));
    return true;
  },

  /** Desfazer: restaura o registro anterior (no real, uma ação compensatória auditada). */
  restore(prev: Appointment) {
    const s = load();
    commit({ ...s, appointments: s.appointments.map((x) => (x.id === prev.id ? prev : x)) });
  },

  /** Aprovação vincula a solicitação a um paciente existente ou novo (F5). */
  approve(id: string, link: { patientId: string } | { create: Omit<Patient, "id"> }) {
    const s = load();
    const a = s.appointments.find((x) => x.id === id);
    if (!a || a.status !== "requested") return false;
    let patients = s.patients;
    let patientId: string;
    if ("patientId" in link) patientId = link.patientId;
    else {
      const p = { ...link.create, id: uid("pt") };
      patients = [...patients, p];
      patientId = p.id;
    }
    commit(
      withEvent(
        { ...s, patients, appointments: s.appointments.map((x) => (x.id === id ? { ...x, status: "confirmed", patientId, holdExpiresAt: undefined } : x)) },
        a, "confirmed", s.viewer.name,
      ),
    );
    return true;
  },

  decline(id: string, reason?: string) {
    const s = load();
    const a = s.appointments.find((x) => x.id === id);
    if (!a || a.status !== "requested") return false;
    commit(
      withEvent(
        {
          ...s,
          appointments: s.appointments.map((x) => (x.id === id ? { ...x, status: "declined" } : x)),
          requests: s.requests.map((r) => (r.appointmentId === id ? { ...r, declineReason: reason } : r)),
        },
        a, "declined", s.viewer.name, reason,
      ),
    );
    return true;
  },

  /** Solicitação pública (RN-30 a RN-35). No real: função security definer + Turnstile + limites. */
  requestPublic(input: { professionalId: string; serviceId: string; startsAt: Date; name: string; phone: string; email?: string; message?: string }):
    | { ok: true; token: string }
    | { ok: false; error: string } {
    const s = expireHolds(load());
    const pendingSamePhone = s.requests.filter(
      (r) => r.phone === input.phone && s.appointments.find((a) => a.id === r.appointmentId)?.status === "requested",
    ).length;
    if (pendingSamePhone >= 3) return { ok: false, error: "Você já tem 3 solicitações aguardando resposta desta clínica." };

    const svc = s.services.find((x) => x.id === input.serviceId)!;
    const end = addMinutes(input.startsAt, svc.durationMin + svc.bufferAfterMin);
    if (hasConflict(s.appointments, input.professionalId, input.startsAt, end)) {
      return { ok: false, error: "Esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor." };
    }
    const now = new Date();
    const id = uid("a");
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
    const a: Appointment = {
      id, professionalId: input.professionalId, serviceId: input.serviceId, patientId: null,
      startsAt: input.startsAt.toISOString(), endsAt: end.toISOString(), status: "requested", origin: "public",
      holdExpiresAt: holdExpiry(now, input.startsAt, s.org.settings.holdHours, s.org.settings.minLeadHours).toISOString(),
      createdAt: now.toISOString(),
    };
    commit({
      ...s,
      appointments: [...s.appointments, a],
      requests: [...s.requests, { appointmentId: id, name: input.name, phone: input.phone, email: input.email, message: input.message, token, consentAt: now.toISOString() }],
      events: [...s.events, { appointmentId: id, from: null, to: "requested", at: now.toISOString(), actor: "Paciente (página pública)" }],
    });
    return { ok: true, token };
  },

  cancelByToken(token: string) {
    const s = load();
    const r = s.requests.find((x) => x.token === token);
    const a = r && s.appointments.find((x) => x.id === r.appointmentId);
    if (!a || !canTransition(a.status, "cancelled")) return false;
    commit(withEvent({ ...s, appointments: s.appointments.map((x) => (x.id === a.id ? { ...x, status: "cancelled" } : x)) }, a, "cancelled", "Paciente (link de status)"));
    return true;
  },

  /** Onboarding: aplica sugestões (sempre editáveis depois). */
  completeOnboarding(answers: { name: string; segment: Segment; size: string; services: string[]; need: Need }) {
    const s = load();
    const family = segmentFamily(answers.segment);
    const suggestions = SEGMENT_SUGGESTIONS[family];
    const features = ["schedule", "online_booking", "finance"];
    const extra = answers.services
      .filter((n) => !s.services.some((x) => x.name.toLowerCase() === n.toLowerCase()))
      .map((n, i) => {
        const sug = suggestions.find((x) => x.name === n);
        return {
          id: uid("s"), name: n, category: sug?.category ?? "Consulta", durationMin: sug?.durationMin ?? 30, bufferAfterMin: 0,
          priceCents: null, isPublic: true, showPrice: false, professionalIds: s.professionals.map((p) => p.id).slice(0, i % 2 ? 3 : 2),
        };
      });
    commit({
      ...s,
      org: { ...s.org, name: answers.name || s.org.name, segment: answers.segment, features, onboarding: answers },
      services: [...s.services, ...extra],
      viewer: { ...VIEWERS.manager },
    });
  },
};

/* Seletores */
export const select = {
  professional: (db: Db, id: string) => db.professionals.find((p) => p.id === id)!,
  service: (db: Db, id: string) => db.services.find((s) => s.id === id)!,
  patient: (db: Db, id: string | null) => (id ? db.patients.find((p) => p.id === id) : undefined),
  request: (db: Db, appointmentId: string) => db.requests.find((r) => r.appointmentId === appointmentId),
  /** Nome exibido: paciente vinculado ou nome informado na solicitação. */
  personName: (db: Db, a: Appointment) =>
    select.patient(db, a.patientId)?.name ?? select.request(db, a.id)?.name ?? "Paciente",
  pendingRequests: (db: Db) =>
    db.appointments
      .filter((a) => a.status === "requested")
      .filter((a) => db.viewer.role !== "professional" || a.professionalId === db.viewer.professionalId)
      .sort((a, b) => +new Date(a.holdExpiresAt!) - +new Date(b.holdExpiresAt!)),
  /** Possíveis duplicidades (RN-41): telefone ou e-mail iguais. */
  matches: (db: Db, phone: string, email?: string) =>
    db.patients.filter((p) => p.phone === phone || (email && p.email && p.email.toLowerCase() === email.toLowerCase())),
  /** Visibilidade do profissional (D-06): detalhes só dos próprios atendimentos. */
  canSeeDetails: (db: Db, a: Appointment) => db.viewer.role !== "professional" || a.professionalId === db.viewer.professionalId,
};
