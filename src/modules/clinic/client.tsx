"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Appointment, Db } from "@/prototype/types";

/**
 * Dados da clínica carregados no servidor (src/modules/clinic/server.ts) e entregues às telas.
 * Depois de cada ação, o servidor revalida o layout e o objeto chega atualizado sozinho.
 */
const DbContext = createContext<Db | null>(null);

export function ClinicDataProvider({ value, children }: { value: Db; children: ReactNode }) {
  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error("useDb fora de ClinicDataProvider (só existe dentro de /c/[org]).");
  return db;
}

const MISSING_SERVICE = { id: "", name: "Serviço", category: "", durationMin: 0, bufferAfterMin: 0, priceCents: null, isPublic: false, showPrice: false, active: false, professionalIds: [] };

/* Seletores */
export const select = {
  professional: (db: Db, id: string) =>
    db.professionals.find((p) => p.id === id) ?? { id, name: "Profissional", specialty: "", color: 1, acceptsPublic: false, active: false, userId: null },
  service: (db: Db, id: string) => db.services.find((s) => s.id === id) ?? MISSING_SERVICE,
  patient: (db: Db, id: string | null) => (id ? db.patients.find((p) => p.id === id) : undefined),
  request: (db: Db, appointmentId: string) => db.requests.find((r) => r.appointmentId === appointmentId),
  /** Nome exibido: paciente vinculado ou nome informado na solicitação. */
  personName: (db: Db, a: Appointment) =>
    select.patient(db, a.patientId)?.name ?? select.request(db, a.id)?.name ?? "Paciente",
  pendingRequests: (db: Db) =>
    db.appointments
      .filter((a) => a.status === "requested" && !a.hidden)
      .sort((a, b) => +new Date(a.holdExpiresAt!) - +new Date(b.holdExpiresAt!)),
  /** Possíveis duplicidades (RN-41): telefone ou e-mail iguais. */
  matches: (db: Db, phone: string, email?: string) =>
    db.patients.filter((p) => (phone && p.phone === phone) || (email && p.email && p.email.toLowerCase() === email.toLowerCase())),
  /** Visibilidade do profissional (D-06): detalhes só dos próprios atendimentos. */
  canSeeDetails: (_db: Db, a: Appointment) => !a.hidden,
  activeProfessionals: (db: Db) => db.professionals.filter((p) => p.active),
};
