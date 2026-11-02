import { z } from "zod";

/* Validação no servidor das ações do módulo (a regra de verdade fica nas funções do banco, 0014–0015). */

const uuid = z.uuid();
const optionalUuid = z.union([z.literal(""), z.uuid()]).optional().transform((v) => v || null);
const optionalDate = z.union([z.literal(""), z.iso.date("Data inválida.")]).optional().transform((v) => v || null);
// Observações curtas e administrativas: a tela avisa para não registrar informação clínica.
const shortNote = z.string().trim().max(300, "Até 300 caracteres.").optional().transform((v) => v || null);

export const contactSchema = z.object({
  id: uuid,
  outcome: z.enum(["no_answer", "call_back", "scheduled", "not_now", "other"], "Escolha o resultado do contato."),
  note: shortNote,
});

export const statusSchema = z
  .object({
    id: uuid,
    status: z.enum(["in_progress", "resolved", "dismissed"]),
    reason: z.string().trim().max(200, "Até 200 caracteres.").optional().default(""),
  })
  .refine((v) => v.status !== "dismissed" || v.reason.length >= 3, { path: ["reason"], message: "Informe o motivo do descarte." });

export const assignSchema = z.object({ id: uuid, userId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null) });

export const waitingSchema = z
  .object({
    patientId: uuid,
    serviceId: optionalUuid,
    professionalId: optionalUuid,
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    periods: z.array(z.enum(["morning", "afternoon", "evening"])).max(3).default([]),
    earliestDate: optionalDate,
    latestDate: optionalDate,
    notes: shortNote,
  })
  .refine((v) => !v.earliestDate || !v.latestDate || v.latestDate >= v.earliestDate, {
    path: ["latestDate"],
    message: "A data final precisa ser depois da inicial.",
  })
  // Lista vazia = sem preferência (o banco guarda nulo).
  .transform((v) => ({
    ...v,
    weekdays: v.weekdays.length ? [...new Set(v.weekdays)].sort() : null,
    periods: v.periods.length ? [...new Set(v.periods)] : null,
  }));

export const followUpSchema = z.object({
  patientId: uuid,
  professionalId: z.uuid("Escolha o profissional."),
  serviceId: optionalUuid,
  dueDate: z.iso.date("Informe o prazo do retorno.").refine((d) => d >= "2000-01-01" && d <= "2100-12-31", "Data inválida."),
  sourceAppointmentId: optionalUuid,
});

export const proposalSchema = z.object({
  patientId: z.uuid("Escolha o paciente."),
  professionalId: optionalUuid,
  title: z.string().trim().min(2, "Dê um nome ao orçamento.").max(120, "Até 120 caracteres."),
  validUntil: optionalDate,
  items: z
    .array(
      z.object({
        serviceId: optionalUuid,
        description: z.string().trim().max(120, "Até 120 caracteres.").optional().default(""),
        quantity: z.number().int("Quantidade inteira.").min(1, "Mínimo 1.").max(999, "Máximo 999."),
        unitPriceCents: z.number().int().min(0, "Valor inválido.").max(100_000_000, "Valor alto demais."),
      }),
    )
    .min(1, "Inclua ao menos um item.")
    .max(50, "Até 50 itens.")
    .refine((items) => items.every((i) => i.serviceId || i.description), "Cada item precisa de um serviço ou descrição."),
});

export const KINDS = ["free_slots", "cancelled_slot", "follow_up_due", "proposal_stale", "no_show", "cancelled_appointment"] as const;

export const settingsSchema = z.object({
  enabledKinds: z.array(z.enum(KINDS)).max(KINDS.length),
  proposalStaleDays: z.number().int().min(1, "De 1 a 90 dias.").max(90, "De 1 a 90 dias."),
  slotHorizonDays: z.number().int().min(1, "De 1 a 30 dias.").max(30, "De 1 a 30 dias."),
  followUpLeadDays: z.number().int().min(0, "De 0 a 90 dias.").max(90, "De 0 a 90 dias."),
  priorityOverrides: z.partialRecord(z.enum(KINDS), z.union([z.literal(1), z.literal(2), z.literal(3)])),
  excludedProfessionalIds: z.array(z.uuid()).max(200),
  receptionSeesValues: z.boolean(),
  professionalsSeeOwn: z.boolean(),
});

export type WaitingInput = z.input<typeof waitingSchema>;
export type FollowUpInput = z.input<typeof followUpSchema>;
export type ProposalInput = z.input<typeof proposalSchema>;
export type SettingsInput = z.input<typeof settingsSchema>;
