import { z } from "zod";

// Mesmos schemas no cliente (feedback imediato) e no servidor (garantia). D-21: senha ≥ 10.
export const PASSWORD_MIN = 10;
// bcrypt ignora o que passa de 72 bytes: limitar evita a falsa sensação de senha mais longa.
const PASSWORD_MAX_BYTES = 72;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe seu e-mail.")
  .max(254, "E-mail longo demais.")
  .pipe(z.email("Informe um e-mail válido."));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`)
  .refine((v) => new TextEncoder().encode(v).length <= PASSWORD_MAX_BYTES, "A senha pode ter no máximo 72 caracteres.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha.").max(200),
});

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo.")
    .max(120, "Nome longo demais."),
  email,
  password: passwordSchema,
});

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não coincidem." });

export type FieldErrors = Partial<Record<string, string>>;

/** Primeiro erro de cada campo, no formato que os formulários exibem. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
