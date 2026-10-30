import { z } from "zod";
import { toE164 } from "@/lib/format";

/** Cadastro de paciente: só dados administrativos (docs/03 §4). Telefone vira E.164. */
export const patientSchema = z
  .object({
    name: z.string().trim().min(3, "Informe o nome completo.").max(160, "Nome longo demais."),
    phone: z.string().trim().max(30).optional().default(""),
    email: z.union([z.literal(""), z.email("E-mail inválido.")]).optional().default(""),
    birthDate: z
      .union([z.literal(""), z.iso.date("Data inválida.")])
      .optional()
      .default("")
      .refine((d) => !d || (d >= "1900-01-01" && d <= new Date().toISOString().slice(0, 10)), "Data inválida."),
    notes: z.string().trim().max(2000, "Até 2.000 caracteres.").optional().default(""),
  })
  .transform((v, ctx) => {
    const phone = v.phone ? toE164(v.phone) : null;
    if (v.phone && !phone) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Informe um celular com DDD." });
      return z.NEVER;
    }
    return { ...v, phone };
  });

export type PatientInput = z.input<typeof patientSchema>;
