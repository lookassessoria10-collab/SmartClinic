import type { Metadata } from "next";
import { connection } from "next/server";
import { requireMember } from "@/server/auth";
import { createSupabaseServerClient } from "@/server/supabase";
import { TeamManager } from "@/modules/team/components/team-manager";
import { BackToGestao, NoPermission } from "@/modules/team/components/gestao-common";

export const metadata: Metadata = { title: "Equipe" };
// Depende da sessão e muda a cada convite: sem casca estática a validar (ADR-013).
export const instant = false;

export default async function TeamPage({ params }: PageProps<"/c/[org]/gestao/equipe">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  if (!ctx.permissions.has("members.manage")) return <NoPermission />;

  const supabase = await createSupabaseServerClient();
  const [team, invitations] = await Promise.all([
    supabase.rpc("list_team", { p_org: ctx.organization.id }),
    supabase
      .from("invitations")
      .select("id, email, role, expires_at, created_at")
      .eq("organization_id", ctx.organization.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (team.error) throw new Error(`Falha ao carregar a equipe: ${team.error.message}`);
  if (invitations.error) throw new Error(`Falha ao carregar convites: ${invitations.error.message}`);

  return (
    <>
      <BackToGestao slug={org} />
      <TeamManager
        slug={org}
        currentUserId={ctx.user.id}
        writable={ctx.writable}
        members={team.data.map((m) => ({
          membershipId: m.membership_id,
          userId: m.user_id,
          name: m.full_name,
          email: m.email,
          role: m.role,
          status: m.status,
          isProfessional: m.is_professional,
        }))}
        invitations={invitations.data.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expires_at }))}
      />
    </>
  );
}
