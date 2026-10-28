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
 */

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 30;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const toBytea = (hex: string) => `\\x${hex}`;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

export async function isLoginThrottled(email: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const emailHash = sha256(email);
  const ipHash = toBytea(sha256(await clientIp()));

  const [byEmail, byIp] = await Promise.all([
    admin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "auth.login_failed")
      .eq("changes->>email_hash", emailHash)
      .gte("created_at", since),
    admin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "auth.login_failed")
      .eq("ip_hash", ipHash)
      .gte("created_at", since),
  ]);
  return (byEmail.count ?? 0) >= MAX_FAILURES_PER_EMAIL || (byIp.count ?? 0) >= MAX_FAILURES_PER_IP;
}

export async function recordAuthEvent(
  action: "auth.login_failed" | "auth.login" | "auth.logout" | "auth.signup" | "auth.password_reset_requested" | "auth.password_changed",
  opts: { email?: string; userId?: string } = {},
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: opts.userId ?? null,
    actor_kind: opts.userId ? "member" : "public",
    action,
    entity: "auth",
    changes: opts.email ? { email_hash: sha256(opts.email) } : null,
    ip_hash: toBytea(sha256(await clientIp())),
  });
  // Falha de auditoria não pode derrubar o login, mas precisa aparecer nos logs do servidor.
  if (error) console.error("[auditoria] falha ao registrar", action, error.message);
}

/** Para onde ir depois de entrar: última clínica usada, primeira clínica, ou onboarding. */
export async function homeAfterLogin(): Promise<string> {
  const memberships = await getMyMemberships();
  if (memberships.length === 0) return "/onboarding";
  const last = (await cookies()).get(LAST_CLINIC_COOKIE)?.value;
  const target = memberships.find((m) => m.slug === last) ?? memberships[0];
  return `/c/${target.slug}/inicio`;
}
