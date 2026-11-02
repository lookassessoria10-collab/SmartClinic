import type { Metadata } from "next";
import { connection } from "next/server";
import { requireMember } from "@/server/auth";
import { createSupabaseServerClient } from "@/server/supabase";
import { NoPermission } from "@/modules/team/components/gestao-common";
import { dbErrorMessage } from "@/modules/clinic/errors";
import { feedArgs, parseFilters } from "@/modules/opportunities/filters";
import { OpportunitiesView } from "@/modules/opportunities/components/opportunities-view";
import type { OpportunitySnapshot } from "@/prototype/types";

export const metadata: Metadata = { title: "Oportunidades" };
export const instant = false;

export default async function OpportunitiesPage({ params, searchParams }: PageProps<"/c/[org]/inicio/oportunidades">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  if (!ctx.permissions.has("opportunities.read") && !ctx.permissions.has("opportunities.read_own")) return <NoPermission />;

  // Filtros vêm da URL (só valores conhecidos); o banco atualiza se algo mudou e mascara valores.
  const filters = parseFilters(await searchParams);
  const supabase = await createSupabaseServerClient();
  const [feed, team] = await Promise.all([
    supabase.rpc("opportunities_feed", feedArgs(ctx.organization.id, filters)),
    supabase.rpc("list_team", { p_org: ctx.organization.id }),
  ]);
  if (feed.error) console.error("[oportunidades] feed", feed.error.code, feed.error.message);

  return (
    <OpportunitiesView
      snapshot={(feed.data as OpportunitySnapshot | null) ?? null}
      error={feed.error ? dbErrorMessage(feed.error) : null}
      filters={filters}
      team={(team.data ?? []).map((m) => ({ userId: m.user_id, name: m.full_name, active: m.status === "active" }))}
    />
  );
}
