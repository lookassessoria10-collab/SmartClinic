"use server";

import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/server/supabase";
import { getCurrentUser } from "@/server/auth";
import { AUTH_MESSAGES, authErrorMessage } from "./messages";
import { fieldErrors, newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema, type FieldErrors } from "./schemas";
import { homeAfterLogin, isLoginThrottled, recordAuthEvent } from "./server";

export interface FormState {
  ok?: boolean;
  message?: string;
  fields?: FieldErrors;
  /** Valores para repreencher o formulário após erro (nunca a senha). */
  values?: Record<string, string>;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/* ---------- Entrar ---------- */

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: str(formData, "email"), password: str(formData, "password") });
  const values = { email: str(formData, "email") };
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };
  const { email, password } = parsed.data;

  if (await isLoginThrottled(email)) {
    return { message: AUTH_MESSAGES.tooManyAttempts, values };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.code !== "email_not_confirmed") await recordAuthEvent("auth.login_failed", { email });
    return { message: authErrorMessage(error), values };
  }
  await recordAuthEvent("auth.login", { userId: data.user.id });

  const next = safeNextPath(formData.get("next"), "");
  redirect(next || (await homeAfterLogin()));
}

/* ---------- Criar conta ---------- */

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { fullName: str(formData, "fullName"), email: str(formData, "email"), password: str(formData, "password") };
  const values = { fullName: raw.fullName, email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/onboarding`,
    },
  });
  // E-mail já cadastrado não gera erro (o Supabase responde igual): não revela cadastro.
  if (error) {
    if (error.code === "weak_password") return { fields: { password: AUTH_MESSAGES.weakPassword }, values };
    return { message: authErrorMessage(error), values };
  }
  await recordAuthEvent("auth.signup", { email: parsed.data.email });
  return { ok: true, values: { email: parsed.data.email } };
}

/* ---------- Esqueci a senha ---------- */

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetRequestSchema.safeParse({ email: str(formData, "email") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values: { email: str(formData, "email") } };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/redefinir-senha/nova`,
  });
  // Mesma resposta exista ou não a conta. Só o limite de envio é informado.
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
    return { message: AUTH_MESSAGES.tooManyAttempts, values: { email: parsed.data.email } };
  }
  if (error) console.error("[auth] resetPasswordForEmail", error.code, error.message);
  await recordAuthEvent("auth.password_reset_requested", { email: parsed.data.email });
  return { ok: true, values: { email: parsed.data.email } };
}

/* ---------- Nova senha (depois do link de redefinição) ---------- */

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: str(formData, "password"), confirm: str(formData, "confirm") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const user = await getCurrentUser();
  if (!user) return { message: AUTH_MESSAGES.linkInvalid };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { fields: { password: "Use uma senha diferente da atual." } };
    if (error.code === "weak_password") return { fields: { password: AUTH_MESSAGES.weakPassword } };
    return { message: authErrorMessage(error) };
  }
  // Encerra as outras sessões: se a senha vazou, quem a usava perde o acesso.
  await supabase.auth.signOut({ scope: "others" });
  await recordAuthEvent("auth.password_changed", { userId: user.id });
  redirect(await homeAfterLogin());
}

/* ---------- Sair ---------- */

export async function signOut(): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  if (user) await recordAuthEvent("auth.logout", { userId: user.id });
  redirect("/login?saiu=1");
}
