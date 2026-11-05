import { ArrowDownCircle, ArrowUpCircle, Scale, Receipt, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Window } from "./mockups";

/* Telas de exemplo do Financeiro (dados fictícios), com as mesmas cores do app e do relatório. */

const ROWS: { income: boolean; text: string; meta: string; status: string; statusClass: string; value: string }[] = [
  { income: true, text: "Consulta · Ana Souza", meta: "Atendimentos · Pix · recebido 09/03", status: "Pago", statusClass: "bg-success-subtle text-success", value: "+ R$ 250,00" },
  { income: false, text: "Aluguel da sala", meta: "Aluguel · Mensal 3 de 12 · vence 10/03", status: "Pendente", statusClass: "bg-info-subtle text-info", value: "− R$ 2.400,00" },
  { income: true, text: "Pacote de sessões · Carla Dias", meta: "Procedimentos · Parcela 2 de 3 · venceu 05/03", status: "Atrasado", statusClass: "bg-danger-subtle text-danger", value: "+ R$ 600,00" },
  { income: false, text: "Material de limpeza", meta: "Materiais e insumos · Cartão de crédito", status: "Pago", statusClass: "bg-success-subtle text-success", value: "− R$ 180,00" },
];

export function MockFinanceEntries() {
  return (
    <Window title="Financeiro">
      <ul className="divide-y divide-line rounded-[12px] border border-line bg-surface">
        {ROWS.map((r) => (
          <li key={r.text} className="flex items-center gap-3 px-3 py-2.5">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", r.income ? "bg-accent-subtle text-accent" : "bg-warning-subtle text-warning")}>
              {r.income ? <ArrowUpCircle className="size-4" aria-hidden /> : <ArrowDownCircle className="size-4" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-sm font-medium">{r.text}</span>
              <span className="block truncate text-caption text-ink-2">{r.meta}</span>
            </span>
            <span className={cn("hidden rounded-full px-2 py-0.5 text-caption font-medium sm:inline", r.statusClass)}>{r.status}</span>
            <span className="tabular w-28 text-right text-body-sm font-semibold">{r.value}</span>
          </li>
        ))}
      </ul>
    </Window>
  );
}

const MONTHS = [
  { m: "Jan", income: 62, expense: 41 },
  { m: "Fev", income: 70, expense: 44 },
  { m: "Mar", income: 84, expense: 47 },
];

export function MockFinanceReport() {
  const tiles: { label: string; value: string; icon: LucideIcon }[] = [
    { label: "Receitas recebidas", value: "R$ 18.400", icon: ArrowUpCircle },
    { label: "Despesas pagas", value: "R$ 10.300", icon: ArrowDownCircle },
    { label: "Resultado", value: "R$ 8.100", icon: Scale },
    { label: "Em atraso", value: "3", icon: Receipt },
  ];
  return (
    <Window title="Relatório financeiro">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[14px] border border-white/80 bg-surface p-2.5 shadow-sm">
            <p className="flex items-center justify-between text-caption text-ink-2">
              {t.label} <t.icon className="size-3.5 text-ink-3" aria-hidden />
            </p>
            <p className="tabular font-semibold">{t.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-[14px] border border-line bg-surface p-3">
        <ul className="mb-2 flex gap-3 text-caption text-ink-2">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-[#0e6bb8]" aria-hidden /> Receitas
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-[#eb6834]" aria-hidden /> Despesas
          </li>
        </ul>
        <div aria-hidden className="flex h-24 items-end gap-4 border-b border-line">
          {MONTHS.map((x) => (
            <div key={x.m} className="flex h-full flex-1 items-end justify-center gap-[2px]">
              <span className="w-4 rounded-t-[4px] bg-[#0e6bb8]" style={{ height: `${x.income}%` }} />
              <span className="w-4 rounded-t-[4px] bg-[#eb6834]" style={{ height: `${x.expense}%` }} />
            </div>
          ))}
        </div>
        <div aria-hidden className="mt-1 flex gap-4">
          {MONTHS.map((x) => (
            <span key={x.m} className="flex-1 text-center text-caption text-ink-2">
              {x.m}
            </span>
          ))}
        </div>
      </div>
    </Window>
  );
}
