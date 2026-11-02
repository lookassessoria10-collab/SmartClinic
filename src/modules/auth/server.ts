import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createSupabaseAdminClient } from "@/server/admin/supabase-admin";
import { getMyMemberships } from "@/server/auth";
import { LAST_CLINIC_COOKIE } from "./constants";

/*
 * Limite de tentativas de login e auditoria de autenticação (docs/12 §3.4, docs/09 S5).
 * Fica na tabela audit_logs (só-anexar), gravada com o cliente admin porque a tentativa
 * falha não tem usuário autenticado. E-mail e IP são guardados apenas como hash.
 *
 * Regra do limite (migração 0013, função login_throttled): 8 falhas por e-mail contadas a
 * partir do mais recente entre 15 min atrás, criação da conta, último login e última troca
 * de senha; 30 por IP em 15 min. Problema na auditoria NUNCA derruba login ou cadastro: o
 * Supabase Auth tem limites próprios por IP, então aqui falhamos "aberto" e registramos.
 */

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const emailHash = (email: string) => sha256(email.trim().toLowerCase());
const toBytea = (hex: string) => `\\x${hex}`;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

export async function isLoginThrottled(email: string): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("login_throttled", { p_email: email, p_ip_hash: toBytea(sha256(await clientIp())) });
    if (error) {
      console.error("[auth] login_throttled", error.code, error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("[auth] limite de tentativas indisponível", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function recordAuthEvent(
  action:
    | "auth.login_failed"
    | "auth.login_error"
    | "auth.login"
    | "auth.logout"
    | "auth.signup"
    | "auth.password_reset_requested"
    | "auth.password_changed"
    | "auth.mfa_verified"
    | "auth.mfa_failed"
    | "auth.mfa_enabled"
    | "auth.mfa_disabled",
  opts: { email?: string | null; userId?: string; reason?: string } = {},
) {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      actor_user_id: opts.userId ?? null,
      actor_kind: opts.userId ? "member" : "public",
      action,
      entity: "auth",
      changes: opts.email || opts.reason ? { ...(opts.email && { email_hash: emailHash(opts.email) }), ...(opts.reason && { reason: opts.reason }) } : null,
      ip_hash: toBytea(sha256(await clientIp())),
    });
    // Falha de auditoria não pode derrubar o login, mas precisa aparecer nos logs do servidor.
    if (error) console.error("[auditoria] falha ao registrar", action, error.message);
  } catch (e) {
    console.error("[auditoria] indisponível", action, e instanceof Error ? e.message : e);
  }
}

/** Para onde ir depois de entrar: última clínica usada, primeira clínica, ou onboarding. */
export async function homeAfterLogin(): Promise<string> {
  const memberships = await getMyMemberships();
  if (memberships.length === 0) return "/onboarding";
  const last = (await cookies()).get(LAST_CLINIC_COOKIE)?.value;
  const target = memberships.find((m) => m.slug === last) ?? memberships[0];
  return `/c/${target.slug}/inicio`;
}
