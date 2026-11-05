import type { Metadata } from "next";
import { connection } from "next/server";
import { requireMember } from "@/server/auth";
import { createSupabaseServerClient } from "@/server/supabase";
import { NoPermission } from "@/modules/team/components/gestao-common";
import { dbErrorMessage } from "@/modules/clinic/errors";
import { parseEntryFilters, type FinanceReport } from "@/modules/finance/model";
import { ReportView } from "@/modules/finance/components/report-view";

export const metadata: Metadata = { title: "Relatório financeiro" };
export const instant = false;

export default async function FinanceReportPage({ params, searchParams }: PageProps<"/c/[org]/financeiro/relatorio">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  // Totais e relatório: só gestão (decisão D-26). O banco confere de novo (finance_report).
  if (!ctx.permissions.has("finance.read")) return <NoPermission />;

  const filters = parseEntryFilters(await searchParams);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("finance_report", { p_org: ctx.organization.id, p_from: filters.from, p_to: filters.to });
  if (error) throw new Error(`Falha ao gerar o relatório: ${dbErrorMessage(error)}`);
  return <ReportView report={data as unknown as FinanceReport} filters={filters} />;
}
