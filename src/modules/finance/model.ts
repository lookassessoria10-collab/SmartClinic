import { addMonths, endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from "date-fns";

/*
 * Financeiro (migração 0016, docs/19): tipos, rótulos e filtros sem dependência de React ou do banco.
 * Datas como "yyyy-MM-dd" (dia do calendário, sem fuso); valores sempre em centavos.
 */

export type FinType = "income" | "expense";
export type FinStatus = "pending" | "paid" | "cancelled";
export type PaymentMethod = "pix" | "cash" | "debit" | "credit" | "transfer" | "boleto" | "other";
export type ModuleKey = "schedule" | "opportunities" | "finance";

export const MODULES: { key: ModuleKey; label: string; description: string; requires?: ModuleKey }[] = [
  { key: "schedule", label: "Agenda e pacientes", description: "Agenda por profissional, horários, bloqueios e cadastro de pacientes." },
  { key: "opportunities", label: "Oportunidades", description: "Horários livres, lista de espera, retornos e orçamentos parados.", requires: "schedule" },
  { key: "finance", label: "Financeiro", description: "Receitas, despesas, contas a pagar e a receber, e relatório do período." },
];

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  debit: "Cartão de débito",
  credit: "Cartão de crédito",
  transfer: "Transferência",
  boleto: "Boleto",
  other: "Outra",
};

export interface Category {
  id: string;
  type: FinType;
  name: string;
  active: boolean;
}

export interface Entry {
  id: string;
  type: FinType;
  categoryId: string;
  description: string;
  amountCents: number;
  dueDate: string;
  paidAt: string | null;
  status: FinStatus;
  method: PaymentMethod | null;
  patientId: string | null;
  professionalId: string | null;
  appointmentId: string | null;
  notes: string | null;
  seriesId: string | null;
  repeatKind: "monthly" | "installments" | null;
  installment: number | null;
  installments: number | null;
}

/** Situação mostrada: pendente vencido vira "Atrasado" (calculado, não guardado). */
export type Situation = "paid" | "pending" | "overdue" | "cancelled";

export function situation(e: Pick<Entry, "status" | "dueDate">, today: string): Situation {
  if (e.status === "pending" && e.dueDate < today) return "overdue";
  return e.status;
}

export const SITUATION_META: Record<Situation, { label: string; className: string }> = {
  paid: { label: "Pago", className: "bg-success-subtle text-success" },
  pending: { label: "Pendente", className: "bg-info-subtle text-info" },
  overdue: { label: "Atrasado", className: "bg-danger-subtle text-danger" },
  cancelled: { label: "Cancelado", className: "bg-muted text-ink-2" },
};

/** "Parcela 2 de 3" ou "Mensal 2 de 12". */
export function seriesLabel(e: Pick<Entry, "repeatKind" | "installment" | "installments">) {
  if (!e.repeatKind || !e.installment || !e.installments) return null;
  return `${e.repeatKind === "installments" ? "Parcela" : "Mensal"} ${e.installment} de ${e.installments}`;
}

/** Valor com sinal para a lista: receita positiva, despesa negativa. */
export const signed = (e: Pick<Entry, "type" | "amountCents">) => (e.type === "income" ? e.amountCents : -e.amountCents);

/* ---------- Filtros da URL ---------- */

export const PERIODS = {
  mes: "Este mês",
  "mes-anterior": "Mês passado",
  "proximos-30": "Próximos 30 dias",
  trimestre: "Últimos 3 meses",
  ano: "Este ano",
  personalizado: "Personalizado",
} as const;
export type Period = keyof typeof PERIODS;

export const TYPES = { todos: "Receitas e despesas", receitas: "Receitas", despesas: "Despesas" } as const;
export const STATUSES = { todos: "Todos", pendentes: "Pendentes", atrasados: "Atrasados", pagos: "Pagos", cancelados: "Cancelados" } as const;

export interface EntryFilters {
  period: Period;
  from: string;
  to: string;
  type: keyof typeof TYPES;
  status: keyof typeof STATUSES;
  category: string;
  q: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const known = <T extends string>(map: Record<T, string>, v: string, fallback: T): T => (v in map ? (v as T) : fallback);
const day = (d: Date) => format(d, "yyyy-MM-dd");

/** Datas do período (o personalizado usa ?de= e ?ate=, limitado a 2 anos e na ordem certa). */
export function periodRange(period: Period, today: Date, custom?: { from?: string; to?: string }): { from: string; to: string } {
  switch (period) {
    case "mes-anterior": {
      const m = subMonths(today, 1);
      return { from: day(startOfMonth(m)), to: day(endOfMonth(m)) };
    }
    case "proximos-30":
      return { from: day(today), to: day(new Date(+today + 30 * 86_400_000)) };
    case "trimestre":
      return { from: day(startOfMonth(subMonths(today, 2))), to: day(endOfMonth(today)) };
    case "ano":
      return { from: day(startOfYear(today)), to: day(endOfYear(today)) };
    case "personalizado": {
      let from = custom?.from && ISO.test(custom.from) ? custom.from : day(startOfMonth(today));
      let to = custom?.to && ISO.test(custom.to) ? custom.to : day(endOfMonth(today));
      if (to < from) [from, to] = [to, from];
      const max = day(addMonths(new Date(`${from}T12:00`), 24));
      if (to > max) to = max;
      return { from, to };
    }
    default:
      return { from: day(startOfMonth(today)), to: day(endOfMonth(today)) };
  }
}

export function parseEntryFilters(sp: Record<string, string | string[] | undefined>, today = new Date()): EntryFilters {
  const period = known(PERIODS, one(sp.periodo), "mes");
  const { from, to } = periodRange(period, today, { from: one(sp.de), to: one(sp.ate) });
  const category = one(sp.categoria);
  return {
    period,
    from,
    to,
    type: known(TYPES, one(sp.tipo), "todos"),
    status: known(STATUSES, one(sp.status), "todos"),
    category: UUID.test(category) ? category.toLowerCase() : "",
    q: one(sp.q).trim().slice(0, 80),
  };
}

export function entryFiltersQuery(f: EntryFilters, patch: Partial<EntryFilters> = {}) {
  const n = { ...f, ...patch };
  const q = new URLSearchParams();
  if (n.period !== "mes") q.set("periodo", n.period);
  if (n.period === "personalizado") {
    q.set("de", n.from);
    q.set("ate", n.to);
  }
  if (n.type !== "todos") q.set("tipo", n.type);
  if (n.status !== "todos") q.set("status", n.status);
  if (n.category) q.set("categoria", n.category);
  if (n.q) q.set("q", n.q);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Uma linha CSV (separador ";" e vírgula decimal: abre direto no Excel em português). */
export function csvRow(cells: (string | number | null | undefined)[]) {
  return cells
    .map((c) => {
      const v = c == null ? "" : String(c);
      // Evita fórmula injetada ao abrir no Excel (=, +, -, @ no começo).
      const safe = /^[=+\-@]/.test(v) && !/^-?\d+(,\d+)?$/.test(v) ? `'${v}` : v;
      return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    })
    .join(";");
}

export const centsToDecimal = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** Resposta de `finance_report` (migração 0016). */
export interface FinanceReport {
  from: string;
  to: string;
  today: string;
  realized: { income: number; expense: number };
  forecast: { income: number; expense: number };
  overdue: { income: number; income_count: number; expense: number; expense_count: number };
  by_category: { type: FinType; name: string; total: number; count: number }[];
  by_method: { method: PaymentMethod | "unknown"; total: number; count: number }[];
  by_professional: { professional_id: string | null; name: string; total: number; count: number }[];
  by_month: { month: string; income: number; expense: number }[];
}
