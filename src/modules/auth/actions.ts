"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { siteUrl } from "@/server/site-url";
import { createSupabaseAdminClient } from "@/server/admin/supabase-admin";
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
    return { message: AUTH_MESSAGES.loginPaused, values };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.code !== "email_not_confirmed") await recordAuthEvent("auth.login_failed", { email });
    return { message: authErrorMessage(error), values };
  }
  // Com o hash do e-mail: login com sucesso zera a contagem de falhas desse e-mail.
  await recordAuthEvent("auth.login", { userId: data.user.id, email });

  const next = safeNextPath(formData.get("next"), "");
  // MFA ativado: a senha abre só o primeiro passo; o código vem na tela seguinte.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect(next ? `/login/mfa?next=${encodeURIComponent(next)}` : "/login/mfa");
  }
  redirect(next || (await homeAfterLogin()));
}

/* ---------- Criar conta ---------- */

/**
 * Cadastro com confirmação por e-mail só quando AUTH_EMAIL_CONFIRMATION=required (exige SMTP
 * próprio configurado no Supabase). Sem isso, o servidor cria a conta já confirmada e entra
 * direto: o cadastro não depende de e-mail nem de configuração no painel (docs/13, risco A8).
 */
const emailConfirmationRequired = () => process.env.AUTH_EMAIL_CONFIRMATION === "required";

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { fullName: str(formData, "fullName"), email: str(formData, "email"), password: str(formData, "password") };
  const values = { fullName: raw.fullName, email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  if (!emailConfirmationRequired()) return signUpWithoutEmail(parsed.data, values);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/onboarding`,
    },
  });
  // E-mail já cadastrado não gera erro (o Supabase responde igual): não revela cadastro.
  if (error) {
    if (error.code === "weak_password") return { fields: { password: AUTH_MESSAGES.weakPassword }, values };
    // Sem o motivo nos logs do servidor não há como diagnosticar (o e-mail não é registrado).
    console.error("[auth] signUp", error.status, error.code, error.message);
    return { message: authErrorMessage(error), values };
  }
  await recordAuthEvent("auth.signup", { email: parsed.data.email });
  // Confirmação de e-mail desligada no projeto: a conta já nasce com sessão → segue direto.
  if (data.session) redirect("/onboarding");
  return { ok: true, values: { email: parsed.data.email } };
}

async function signUpWithoutEmail(
  input: { fullName: string; email: string; password: string },
  values: Record<string, string>,
): Promise<FormState> {
  let created;
  try {
    const admin = createSupabaseAdminClient();
    created = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });
  } catch (e) {
    console.error("[auth] createUser indisponível", e instanceof Error ? e.message : e);
    return { message: AUTH_MESSAGES.unexpected, values };
  }
  if (created.error) {
    const err = created.error;
    if (err.code === "weak_password") return { fields: { password: AUTH_MESSAGES.weakPassword }, values };
    if (err.code === "email_exists" || err.code === "user_already_exists" || err.status === 422) {
      return { message: AUTH_MESSAGES.accountExists, values };
    }
    console.error("[auth] createUser", err.status, err.code, err.message);
    return { message: authErrorMessage(err), values };
  }

  await recordAuthEvent("auth.signup", { email: input.email });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) {
    // Conta criada; se o login automático falhar, a pessoa entra pela tela de login.
    console.error("[auth] login após cadastro", error.code, error.message);
    redirect("/login?criada=1");
  }
  await recordAuthEvent("auth.login", { userId: created.data.user?.id, email: input.email });
  redirect("/onboarding");
}

/* ---------- Esqueci a senha ---------- */

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetRequestSchema.safeParse({ email: str(formData, "email") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values: { email: str(formData, "email") } };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/redefinir-senha/nova`,
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
  // Troca de senha libera um e-mail que estava pausado por tentativas erradas.
  await recordAuthEvent("auth.password_changed", { userId: user.id, email: user.email });
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
