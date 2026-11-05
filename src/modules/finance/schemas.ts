import { z } from "zod";
import { parsePrice } from "@/modules/catalog/schemas";

/* Validação no servidor das ações do Financeiro; a regra final fica nas funções do banco (0016). */

const optionalUuid = z.union([z.literal(""), z.uuid()]).optional().transform((v) => v || null);
const date = z.iso.date("Data inválida.").refine((d) => d >= "2000-01-01" && d <= "2100-12-31", "Data inválida.");
export const METHODS = ["pix", "cash", "debit", "credit", "transfer", "boleto", "other"] as const;

/** "1.250,90" ou "1250,9" → 125090 centavos (aceita separador de milhar). */
export function parseMoney(input: string): number | null {
  const s = input.trim().replace(/^R\$\s*/i, "").replace(/\.(?=\d{3}(\D|$))/g, "");
  const cents = parsePrice(s);
  return cents == null || cents === undefined ? null : cents;
}

export const entrySchema = z
  .object({
    type: z.enum(["income", "expense"]),
    categoryId: z.uuid("Escolha a categoria."),
    description: z.string().trim().min(2, "Descreva o lançamento.").max(160, "Até 160 caracteres."),
    amount: z.string(),
    dueDate: date,
    paid: z.boolean(),
    paidAt: z.union([z.literal(""), date]).optional().default(""),
    method: z.union([z.literal(""), z.enum(METHODS)]).optional().default(""),
    patientId: optionalUuid,
    professionalId: optionalUuid,
    notes: z.string().trim().max(300, "Até 300 caracteres.").optional().default(""),
    repeat: z.enum(["none", "monthly", "installments"]).default("none"),
    count: z.number().int().min(1).max(60).default(1),
  })
  .transform((v, ctx) => {
    const cents = parseMoney(v.amount);
    if (cents == null || cents < 1) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Informe o valor (ex.: 150,00)." });
      return z.NEVER;
    }
    if (v.repeat !== "none" && (v.count < 2 || v.count > 60)) {
      ctx.addIssue({ code: "custom", path: ["count"], message: "De 2 a 60 vezes." });
      return z.NEVER;
    }
    if (v.paid && !v.paidAt) {
      ctx.addIssue({ code: "custom", path: ["paidAt"], message: "Informe a data do pagamento." });
      return z.NEVER;
    }
    return { ...v, amountCents: cents, paidAt: v.paid ? v.paidAt : null, method: v.paid && v.method ? v.method : null };
  });

export const paySchema = z.object({
  id: z.uuid(),
  paidAt: date,
  method: z.union([z.literal(""), z.enum(METHODS)]).optional().transform((v) => v || null),
});

export const receiveSchema = z.object({
  appointmentId: z.uuid(),
  amount: z.string(),
  paidAt: date,
  method: z.union([z.literal(""), z.enum(METHODS)]).optional().transform((v) => v || null),
});

export const categorySchema = z.object({
  id: optionalUuid,
  type: z.enum(["income", "expense"]),
  name: z.string().trim().min(2, "Mínimo de 2 caracteres.").max(60, "Até 60 caracteres."),
  active: z.boolean().default(true),
});

export const modulesSchema = z
  .array(z.enum(["schedule", "opportunities", "finance"]))
  .min(1, "Escolha ao menos um módulo.")
  .refine((m) => !m.includes("opportunities") || m.includes("schedule"), "Oportunidades usa a Agenda: ligue a Agenda também.");

export type EntryInput = z.input<typeof entrySchema>;
