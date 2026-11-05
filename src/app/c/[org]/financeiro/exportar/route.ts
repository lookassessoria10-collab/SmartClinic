import { format } from "date-fns";
import { requireMember } from "@/server/auth";
import { createSupabaseServerClient } from "@/server/supabase";
import { METHOD_LABEL, SITUATION_META, centsToDecimal, csvRow, parseEntryFilters, situation } from "@/modules/finance/model";
import { loadCategories, loadEntries } from "@/modules/finance/server";

/**
 * Exporta os lançamentos do filtro em CSV (gestão). Lido com a sessão da pessoa (RLS); sem nome de
 * paciente no arquivo (dado pessoal desnecessário para conferência financeira).
 */
export async function GET(request: Request, { params }: RouteContext<"/c/[org]/financeiro/exportar">) {
  const { org } = await params;
  const ctx = await requireMember(org);
  if (!ctx.permissions.has("finance.read")) return new Response("Sem permissão.", { status: 403 });

  const url = new URL(request.url);
  const filters = parseEntryFilters(Object.fromEntries(url.searchParams));
  const supabase = await createSupabaseServerClient();
  const [entries, categories, pros] = await Promise.all([
    loadEntries(supabase, ctx.organization.id, filters),
    loadCategories(supabase, ctx.organization.id),
    supabase.from("professionals").select("id, display_name").eq("organization_id", ctx.organization.id),
  ]);
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const pro = new Map((pros.data ?? []).map((p) => [p.id, p.display_name]));
  const today = format(new Date(), "yyyy-MM-dd");

  const lines = [
    csvRow(["Tipo", "Situação", "Vencimento", "Pagamento", "Descrição", "Categoria", "Forma de pagamento", "Profissional", "Parcela", "Valor (R$)"]),
    ...entries.map((e) =>
      csvRow([
        e.type === "income" ? "Receita" : "Despesa",
        SITUATION_META[situation(e, today)].label,
        e.dueDate.split("-").reverse().join("/"),
        e.paidAt ? e.paidAt.split("-").reverse().join("/") : "",
        e.description,
        cat.get(e.categoryId) ?? "",
        e.method ? METHOD_LABEL[e.method] : "",
        e.professionalId ? (pro.get(e.professionalId) ?? "") : "",
        e.installment && e.installments ? `${e.installment}/${e.installments}` : "",
        (e.type === "income" ? "" : "-") + centsToDecimal(e.amountCents),
      ]),
    ),
  ];
  // BOM: o Excel reconhece UTF-8 (acentos) ao abrir direto.
  const body = "﻿" + lines.join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financeiro-${filters.from}-a-${filters.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
