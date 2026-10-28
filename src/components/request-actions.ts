"use client";

import { actions, select } from "@/prototype/store";
import type { Db } from "@/prototype/types";

/**
 * Aprovação rápida: vincula ao paciente existente quando há exatamente uma correspondência;
 * caso contrário, cria um novo. Para escolher manualmente, use a fila de solicitações.
 */
export function quickApprove(db: Db, appointmentId: string) {
  const req = select.request(db, appointmentId)!;
  const matches = select.matches(db, req.phone, req.email);
  if (matches.length === 1) {
    actions.approve(appointmentId, { patientId: matches[0].id });
    return `Confirmado e vinculado a ${matches[0].name}.`;
  }
  actions.approve(appointmentId, { create: { name: req.name, phone: req.phone, email: req.email } });
  return `Confirmado. ${req.name} foi cadastrado(a) como paciente.`;
}
