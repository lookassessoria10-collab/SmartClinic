"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/ui/button";
import { Input, Select } from "@/ui/field";
import { Card, CardHeader, PageHeader } from "@/ui/primitives";
import { fmt, money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { METHOD_LABEL, PERIODS, entryFiltersQuery, type EntryFilters, type FinanceReport, type Period } from "../model";
import { FinanceNav } from "./finance-nav";
import { Summary } from "./entries-view";

// Duas séries com identidade (não "bom/ruim"): azul da marca e laranja, par validado para
// daltonismo e contraste (skill dataviz). O texto fica sempre na cor do texto.
const SERIES = { income: "#0e6bb8", expense: "#eb6834" } as const;
const REPORT_PERIODS = Object.fromEntries(Object.entries(PERIODS).filter(([k]) => k !== "proximos-30")) as Record<Exclude<Period, "proximos-30">, string>;
const day = (iso: string) => fmt(`${iso}T12:00`, "dd/MM/yyyy");
const monthLabel = (ym: string) => fmt(`${ym}-15T12:00`, "MMM/yy");

export function ReportView({ report, filters }: { report: FinanceReport; filters: EntryFilters }) {
  const { org } = useParams<{ org: string }>();
  const base = `/c/${org}/financeiro`;
  const incomeCats = report.by_category.filter((c) => c.type === "income");
  const expenseCats = report.by_category.filter((c) => c.type === "expense");

  return (
    <>
      <FinanceNav />
      <PageHeader
        title="Relatório financeiro"
        description={`${day(report.from)} a ${day(report.to)} · realizado pela data do pagamento, previsto pelo vencimento. Cancelados não entram.`}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Link href={`${base}/exportar${entryFiltersQuery(filters)}`} prefetch={false} className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-body-sm font-medium glass hover:bg-white/80">
              <Download className="size-4" aria-hidden /> Exportar CSV
            </Link>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Imprimir
            </Button>
          </div>
        }
      />
      <PeriodForm base={`${base}/relatorio`} filters={filters} />
      <Summary report={report} />

      <Card className="mb-4 break-inside-avoid">
        <CardHeader title="Mês a mês" description="Receitas recebidas e despesas pagas em cada mês do período." />
        <MonthlyChart data={report.by_month} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="Receitas por categoria" rows={incomeCats.map((c) => ({ label: c.name, total: c.total, count: c.count }))} empty="Nenhuma receita recebida no período." />
        <Breakdown title="Despesas por categoria" rows={expenseCats.map((c) => ({ label: c.name, total: c.total, count: c.count }))} empty="Nenhuma despesa paga no período." />
        <Breakdown
          title="Recebimentos por forma de pagamento"
          rows={report.by_method.map((m) => ({ label: m.method === "unknown" ? "Não informada" : METHOD_LABEL[m.method], total: m.total, count: m.count }))}
          empty="Nenhum recebimento no período."
        />
        <Breakdown title="Recebimentos por profissional" rows={report.by_professional.map((p) => ({ label: p.name, total: p.total, count: p.count }))} empty="Nenhum recebimento no período." />
      </div>
    </>
  );
}

function PeriodForm({ base, filters }: { base: string; filters: EntryFilters }) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>(filters.period === "proximos-30" ? "mes" : filters.period);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  return (
    <form
      className="mb-4 flex flex-wrap items-end gap-2 print:hidden"
      aria-label="Período do relatório"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`${base}${entryFiltersQuery({ ...filters, period, from, to, type: "todos", status: "todos", category: "", q: "" })}`, { scroll: false });
      }}
    >
      <label className="flex flex-col gap-1 text-caption text-ink-2">
        Período
        <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="h-10 min-w-40 text-body-sm">
          {Object.entries(REPORT_PERIODS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </label>
      {period === "personalizado" && (
        <>
          <label className="flex flex-col gap-1 text-caption text-ink-2">
            De
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 text-body-sm" />
          </label>
          <label className="flex flex-col gap-1 text-caption text-ink-2">
            Até
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 text-body-sm" />
          </label>
        </>
      )}
      <Button type="submit" variant="secondary">
        Ver relatório
      </Button>
    </form>
  );
}

/** Barras agrupadas por mês, com legenda, valor no foco/toque e a mesma informação em tabela. */
function MonthlyChart({ data }: { data: FinanceReport["by_month"] }) {
  const max = Math.max(1, ...data.flatMap((m) => [m.income, m.expense]));
  const [active, setActive] = useState<string | null>(null);
  const hasData = data.some((m) => m.income || m.expense);
  return (
    <div className="px-5 pb-5">
      <ul className="mb-3 flex gap-4 text-caption text-ink-2" aria-label="Legenda">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px]" style={{ background: SERIES.income }} aria-hidden /> Receitas
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px]" style={{ background: SERIES.expense }} aria-hidden /> Despesas
        </li>
      </ul>
      {hasData ? (
        <div aria-hidden className="flex h-48 items-end gap-3 overflow-x-auto border-b border-line pb-px">
          {data.map((m) => (
            <div
              key={m.month}
              className="relative flex min-w-12 flex-1 flex-col items-center"
              onPointerEnter={() => setActive(m.month)}
              onPointerLeave={() => setActive((a) => (a === m.month ? null : a))}
            >
              {active === m.month && (
                <div className="absolute -top-14 z-10 rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-caption whitespace-nowrap shadow-sm">
                  <p className="font-semibold">{monthLabel(m.month)}</p>
                  <p className="tabular">Receitas {money(m.income)} · Despesas {money(m.expense)}</p>
                </div>
              )}
              <div className="flex h-44 w-full items-end justify-center gap-[2px]">
                {(["income", "expense"] as const).map((k) => (
                  <span
                    key={k}
                    className="w-1/3 max-w-6 rounded-t-[4px]"
                    style={{ height: `${Math.max(m[k] ? 2 : 0, (m[k] / max) * 100)}%`, background: SERIES[k] }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-body-sm text-ink-2">Sem recebimentos nem pagamentos no período.</p>
      )}
      {hasData && (
        <div aria-hidden className="mt-1 flex gap-3 overflow-x-hidden">
          {data.map((m) => (
            <span key={m.month} className="min-w-12 flex-1 text-center text-caption text-ink-2">
              {monthLabel(m.month)}
            </span>
          ))}
        </div>
      )}
      <details className="mt-4 print:block" open={false}>
        <summary className="cursor-pointer text-body-sm font-medium text-accent print:hidden">Ver em tabela</summary>
        <MonthTable data={data} />
      </details>
      {/* Na impressão, a tabela sempre aparece. */}
      <div className="hidden print:block">
        <MonthTable data={data} />
      </div>
    </div>
  );
}

function MonthTable({ data }: { data: FinanceReport["by_month"] }) {
  return (
    <table className="mt-2 w-full text-left text-body-sm">
      <caption className="sr-only">Receitas e despesas por mês</caption>
      <thead className="text-caption text-ink-2">
        <tr>
          <th scope="col" className="py-1.5 font-semibold">Mês</th>
          <th scope="col" className="py-1.5 text-right font-semibold">Receitas</th>
          <th scope="col" className="py-1.5 text-right font-semibold">Despesas</th>
          <th scope="col" className="py-1.5 text-right font-semibold">Resultado</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {data.map((m) => (
          <tr key={m.month}>
            <th scope="row" className="py-1.5 font-medium capitalize">{monthLabel(m.month)}</th>
            <td className="tabular py-1.5 text-right">{money(m.income)}</td>
            <td className="tabular py-1.5 text-right">{money(m.expense)}</td>
            <td className="tabular py-1.5 text-right">{money(m.income - m.expense)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Breakdown({ title, rows, empty }: { title: string; rows: { label: string; total: number; count: number }[]; empty: string }) {
  const sum = rows.reduce((s, r) => s + r.total, 0);
  return (
    <Card className="break-inside-avoid">
      <CardHeader title={title} description={rows.length ? `Total ${money(sum)}` : undefined} />
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-body-sm text-ink-2">{empty}</p>
      ) : (
        <table className="w-full text-left text-body-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="border-y border-line bg-canvas text-caption text-ink-2">
            <tr>
              <th scope="col" className="px-5 py-2 font-semibold">Item</th>
              <th scope="col" className="px-5 py-2 text-right font-semibold">Lançamentos</th>
              <th scope="col" className="px-5 py-2 text-right font-semibold">Total</th>
              <th scope="col" className="px-5 py-2 text-right font-semibold">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="px-5 py-2 font-medium">{r.label}</th>
                <td className="tabular px-5 py-2 text-right text-ink-2">{r.count}</td>
                <td className="tabular px-5 py-2 text-right">{money(r.total)}</td>
                <td className={cn("tabular px-5 py-2 text-right text-ink-2")}>{sum ? Math.round((r.total / sum) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
