"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/server/supabase";
import { getCurrentUser, requireUser } from "@/server/auth";
import { homeAfterLogin, recordAuthEvent } from "./server";

/*
 * Verificação em duas etapas por aplicativo autenticador (TOTP), D-19.
 * O Supabase Auth guarda o segredo e valida o código; o banco exige o segundo passo
 * para liberar dados (migração 0010).
 */

export interface MfaState {
  ok?: boolean;
  message?: string;
  field?: string;
}

const codeSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().length(6, "O código tem 6 números."));

/* ---------- Login: segundo passo ---------- */

export async function verifyLoginCode(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const parsed = codeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!parsed.success) return { field: parsed.error.issues[0].message };

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp.find((f) => f.status === "verified");
  if (!totp) redirect(await homeAfterLogin());

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: parsed.data });
  if (error) {
    await recordAuthEvent("auth.mfa_failed", { userId: user.id });
    return error.status === 429
      ? { message: "Muitas tentativas. Aguarde alguns minutos e tente de novo." }
      : { field: "Código incorreto ou expirado. Confira o horário do celular e tente o código atual." };
  }
  await recordAuthEvent("auth.mfa_verified", { userId: user.id });
  const next = safeNextPath(formData.get("next"), "");
  redirect(next || (await homeAfterLogin()));
}

/* ---------- Minha conta: ativar / remover ---------- */

export interface Enrollment {
  factorId: string;
  qrCode: string; // SVG em data URI, gerado pelo Supabase
  secret: string; // para digitar no aplicativo se não der para ler o QR
}

export async function startMfaEnrollment(): Promise<{ enrollment?: Enrollment; message?: string }> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  // Tentativas anteriores não concluídas ficam como "não verificadas": limpa antes de começar.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Aplicativo autenticador (${new Date().toLocaleDateString("pt-BR")})`,
  });
  if (error || !data) {
    console.error("[mfa] enroll", error?.code, error?.message);
    return { message: "Não foi possível iniciar agora. Tente de novo em instantes." };
  }
  return { enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

export async function confirmMfaEnrollment(factorId: string, code: string): Promise<MfaState> {
  const user = await requireUser();
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return { field: parsed.error.issues[0].message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: parsed.data });
  if (error) return { field: "Código incorreto. Use o código que aparece agora no aplicativo." };

  await recordAuthEvent("auth.mfa_enabled", { userId: user.id });
  revalidatePath("/c", "layout");
  return { ok: true, message: "Verificação em duas etapas ativada. Nos próximos logins, o código será pedido." };
}

export async function removeMfaFactor(factorId: string): Promise<MfaState> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    console.error("[mfa] unenroll", error.code, error.message);
    return { message: "Não foi possível remover agora. Saia, entre de novo com o código e tente outra vez." };
  }
  await recordAuthEvent("auth.mfa_disabled", { userId: user.id });
  revalidatePath("/c", "layout");
  return { ok: true, message: "Verificação em duas etapas removida." };
}
