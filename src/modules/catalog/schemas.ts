import { z } from "zod";

/** Cadastros da Fase 4–5. As mesmas regras existem no banco (CHECKs da 0011/0012). */

const ids = z.array(z.uuid()).max(200).default([]);

export const professionalSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120, "Nome longo demais."),
  specialty: z.string().trim().max(120).optional().default(""),
  councilType: z.string().trim().max(20).optional().default(""),
  councilNumber: z.string().trim().max(30).optional().default(""),
  color: z.coerce.number().int().min(1).max(8).default(1),
  acceptsPublic: z.boolean().default(true),
  active: z.boolean().default(true),
  userId: z.union([z.uuid(), z.literal(""), z.null()]).optional().transform((v) => v || null),
  serviceIds: ids,
});
export type ProfessionalInput = z.input<typeof professionalSchema>;

/** "150,00" ou "150" → 15000 centavos; vazio → sem preço. */
export function parsePrice(input: string): number | null | undefined {
  const s = input.trim().replace(/^R\$\s*/i, "");
  if (!s) return null;
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(s)) return undefined;
  const [int, dec = ""] = s.split(/[.,]/);
  return Number(int) * 100 + Number(dec.padEnd(2, "0"));
}

export const serviceSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome.").max(120, "Nome longo demais."),
    category: z.string().trim().max(60).optional().default(""),
    durationMin: z.coerce.number({ message: "Informe a duração." }).int().min(5, "Mínimo de 5 minutos.").max(720, "Máximo de 12 horas."),
    bufferAfterMin: z.coerce.number().int().min(0).max(120, "Máximo de 120 minutos.").default(0),
    price: z.string().optional().default(""),
    isPublic: z.boolean().default(true),
    showPrice: z.boolean().default(false),
    active: z.boolean().default(true),
    professionalIds: ids,
  })
  .transform((v, ctx) => {
    const priceCents = parsePrice(v.price);
    if (priceCents === undefined) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Use o formato 150,00." });
      return z.NEVER;
    }
    return { ...v, priceCents };
  });
export type ServiceInput = z.input<typeof serviceSchema>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

export const weeklyRulesSchema = z
  .array(z.object({ weekday: z.number().int().min(0).max(6), start: hhmm, end: hhmm }))
  .max(50)
  .superRefine((rules, ctx) => {
    rules.forEach((r, i) => {
      if (r.end <= r.start) ctx.addIssue({ code: "custom", path: [i], message: "O fim precisa ser depois do início." });
      for (const o of rules.slice(i + 1)) {
        if (o.weekday === r.weekday && r.start < o.end && o.start < r.end) {
          ctx.addIssue({ code: "custom", path: [i], message: "Há faixas sobrepostas no mesmo dia." });
        }
      }
    });
  });
export type WeeklyRule = z.infer<typeof weeklyRulesSchema>[number];

export const blockSchema = z
  .object({
    professionalId: z.union([z.uuid(), z.literal(""), z.null()]).transform((v) => v || null),
    kind: z.enum(["break", "time_off", "vacation", "holiday", "other"]),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().max(200).optional().default(""),
  })
  .refine((b) => new Date(b.endsAt) > new Date(b.startsAt), { path: ["endsAt"], message: "O fim precisa ser depois do início." });
export type BlockInput = z.input<typeof blockSchema>;

export const BLOCK_KINDS = [
  { value: "holiday", label: "Feriado" },
  { value: "vacation", label: "Férias" },
  { value: "time_off", label: "Folga" },
  { value: "break", label: "Pausa" },
  { value: "other", label: "Outro" },
] as const;
