import type { Metadata } from "next";
import { connection } from "next/server";
import { requireMember } from "@/server/auth";
import { createSupabaseServerClient } from "@/server/supabase";
import { NoPermission } from "@/modules/team/components/gestao-common";
import { parseEntryFilters, type FinanceReport, type FinType } from "@/modules/finance/model";
import { LIST_LIMIT, loadCategories, loadEntries } from "@/modules/finance/server";
import { EntriesView } from "@/modules/finance/components/entries-view";

export const metadata: Metadata = { title: "Financeiro" };
export const instant = false;

export default async function FinancePage({ params, searchParams }: PageProps<"/c/[org]/financeiro">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  const canRead = ctx.permissions.has("finance.read");
  if (!canRead && !ctx.permissions.has("finance.write")) return <NoPermission />;

  const sp = await searchParams;
  const filters = parseEntryFilters(sp);
  const supabase = await createSupabaseServerClient();
  const [entries, categories, report] = await Promise.all([
    loadEntries(supabase, ctx.organization.id, filters),
    loadCategories(supabase, ctx.organization.id),
    // Totais só para quem vê o financeiro inteiro (gestão); a recepção lança sem ver totais.
    canRead
      ? supabase.rpc("finance_report", { p_org: ctx.organization.id, p_from: filters.from, p_to: filters.to })
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (report.error) console.error("[financeiro] resumo", report.error.code, report.error.message);
  const novo = (Array.isArray(sp.novo) ? sp.novo[0] : sp.novo) ?? "";
  const openNew: FinType | null = novo === "receita" ? "income" : novo === "despesa" ? "expense" : null;

  return (
    <EntriesView
      entries={entries}
      categories={categories}
      filters={filters}
      report={(report.data as FinanceReport | null) ?? null}
      truncated={entries.length === LIST_LIMIT}
      openNew={openNew}
    />
  );
}
