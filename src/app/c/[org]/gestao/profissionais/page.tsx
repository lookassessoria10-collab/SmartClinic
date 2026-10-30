import type { Metadata } from "next";
import { connection } from "next/server";
import { requireMember } from "@/server/auth";
import { createSupabaseServerClient } from "@/server/supabase";
import { ProfessionalsManager } from "@/modules/catalog/components/professionals-manager";
import { BackToGestao, NoPermission } from "@/modules/team/components/gestao-common";

export const metadata: Metadata = { title: "Profissionais" };
export const instant = false;

export default async function ProfessionalsPage({ params }: PageProps<"/c/[org]/gestao/profissionais">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  if (!ctx.permissions.has("professionals.manage")) return <NoPermission />;

  // Membros ativos, para ligar um profissional à conta de quem atende (vê a própria agenda).
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_team", { p_org: ctx.organization.id });
  if (error) throw new Error(`Falha ao carregar a equipe: ${error.message}`);

  return (
    <>
      <BackToGestao slug={org} />
      <ProfessionalsManager
        writable={ctx.writable}
        members={data.filter((m) => m.status === "active").map((m) => ({ userId: m.user_id, name: m.full_name }))}
      />
    </>
  );
}
