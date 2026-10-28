import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase";
import type { Database } from "./database.types";

/*
 * Autorização no servidor (docs/04 §3, camada 2). A RLS no banco é a garantia final;
 * aqui ficam as mensagens claras e as regras que o SQL não expressa bem.
 *
 * Cache: só React.cache (escopo de UMA requisição). Nunca `use cache` para sessão ou
 * permissões — desativar alguém precisa valer na próxima requisição (docs/12 §3.3).
 */

export type MemberRole = Database["public"]["Enums"]["member_role"];

export interface CurrentUser {
  id: string;
  email: string | null;
}

/** Usuário da sessão, com o token validado (getClaims verifica a assinatura). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
});

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

export interface MembershipSummary {
  organizationId: string;
  slug: string;
  name: string;
  role: MemberRole;
}

/** Clínicas em que a pessoa tem vínculo ativo (para o seletor de clínica e o pós-login). */
export const getMyMemberships = cache(async (): Promise<MembershipSummary[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organizations!inner(id, slug, name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at");
  if (error) throw new Error(`Falha ao carregar clínicas: ${error.message}`);
  return (data ?? []).map((m) => ({
    organizationId: m.organizations.id,
    slug: m.organizations.slug,
    name: m.organizations.name,
    role: m.role,
  }));
});

export interface MemberContext {
  user: CurrentUser;
  organization: { id: string; slug: string; name: string; status: Database["public"]["Enums"]["org_status"] };
  role: MemberRole;
  permissions: ReadonlySet<string>;
  writable: boolean;
}

/**
 * Exige vínculo ativo com a clínica do slug. Quem não é membro recebe 404 — a mesma resposta
 * de um slug inexistente, para não revelar quais clínicas existem.
 */
export const requireMember = cache(async (slug: string): Promise<MemberContext> => {
  const user = await requireUser(`/c/${slug}/inicio`);
  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, slug, name, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!org) notFound();

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  // Admin da plataforma enxerga a linha da clínica pela RLS, mas não é membro: 404 também.
  if (!membership) notFound();

  const { data: perms, error } = await supabase
    .from("role_permissions")
    .select("permission")
    .eq("role", membership.role);
  if (error) throw new Error(`Falha ao carregar permissões: ${error.message}`);

  return {
    user,
    organization: org,
    role: membership.role,
    permissions: new Set((perms ?? []).map((p) => p.permission)),
    writable: org.status === "trial" || org.status === "active",
  };
});

export class ForbiddenError extends Error {
  constructor(public readonly permission: string) {
    super(`Sem permissão: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export class ReadOnlyError extends Error {
  constructor() {
    super("Clínica em modo somente leitura.");
    this.name = "ReadOnlyError";
  }
}

/** Para Server Actions: lança erro tipado; a RLS recusaria de qualquer forma. */
export function requirePermission(ctx: MemberContext, permission: string, opts: { write?: boolean } = {}) {
  if (!ctx.permissions.has(permission)) throw new ForbiddenError(permission);
  if (opts.write && !ctx.writable) throw new ReadOnlyError();
}
