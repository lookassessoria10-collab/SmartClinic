import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/server/admin/supabase-admin";

/*
 * Envio do e-mail de convite pelo próprio Supabase Auth (sem provedor extra):
 *  - pessoa sem conta → e-mail "invite" (cria a conta; ela define a senha no aceite);
 *  - pessoa com conta → link de acesso (magic link).
 * Nos dois casos o link passa por /auth/confirm e termina em /convite/<código>.
 * Local: os e-mails ficam no Mailpit. Staging: requer SMTP próprio (D-16).
 */

export function invitationLink(token: string) {
  return `${publicEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(`/convite/${token}`)}`;
}

export async function sendInvitationEmail(email: string, token: string): Promise<{ ok: boolean }> {
  const redirectTo = invitationLink(token);
  const admin = createSupabaseAdminClient();
  // needs_password: a conta nasce com senha aleatória do Supabase; o aceite pede uma senha de verdade.
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { needs_password: true } });
  if (!error) return { ok: true };

  // Já existe conta com este e-mail: manda um link de acesso que leva ao mesmo convite.
  if (error.code === "email_exists" || error.status === 422) {
    return sendAccessLink(email, redirectTo);
  }
  console.error("[convite] inviteUserByEmail", error.code, error.message);
  return { ok: false };
}

/** Link de acesso de uso único. Cliente sem sessão e fluxo "implicit": o link funciona em qualquer navegador. */
export async function sendAccessLink(email: string, redirectTo: string): Promise<{ ok: boolean }> {
  const anon = createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "implicit" },
  });
  const { error } = await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
  if (error) console.error("[convite] signInWithOtp", error.code, error.message);
  return { ok: !error };
}
