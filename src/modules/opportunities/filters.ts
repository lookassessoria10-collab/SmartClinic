import type { OpportunityCategory } from "@/prototype/types";

/*
 * Filtros da tela de Oportunidades vêm da URL (como na Auditoria): só valores conhecidos são
 * aceitos; qualquer outro vira o padrão. O banco confere de novo (opportunities_feed).
 */

export const TABS = { todas: "Todas", agenda: "Agenda", pacientes: "Pacientes", financeiro: "Financeiro", resolvidas: "Resolvidas" } as const;
export const PERIODS = { "7": "Próximos 7 dias", "14": "Próximos 14 dias", "30": "Próximos 30 dias" } as const;
export const SORTS = { prioridade: "Prioridade", valor: "Valor potencial", data: "Data" } as const;
// "Mostrar mais" acumula páginas até o limite do feed (100 itens por chamada).
export const PAGE_SIZE = 25;
export const MAX_PAGES = 4;

export type Tab = keyof typeof TABS;
export type Period = keyof typeof PERIODS;
export type Sort = keyof typeof SORTS;

export interface Filters {
  tab: Tab;
  period: Period;
  sort: Sort;
  professional: string; // "" = todos
  page: number; // 1, 2, ... ("Mostrar mais" acumula)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const known = <T extends string>(map: Record<T, string>, v: string, fallback: T): T => (v in map ? (v as T) : fallback);

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const page = Number.parseInt(one(sp.pagina), 10);
  const professional = one(sp.profissional);
  return {
    tab: known(TABS, one(sp.tab), "todas"),
    period: known(PERIODS, one(sp.periodo), "14"),
    sort: known(SORTS, one(sp.ordem), "prioridade"),
    professional: UUID.test(professional) ? professional.toLowerCase() : "",
    page: Number.isFinite(page) && page >= 1 && page <= MAX_PAGES ? page : 1,
  };
}

/** Argumentos de `opportunities_feed` para os filtros da tela. */
export function feedArgs(org: string, f: Filters) {
  const category: OpportunityCategory | undefined = f.tab === "agenda" || f.tab === "pacientes" || f.tab === "financeiro" ? f.tab : undefined;
  return {
    p_org: org,
    p_view: f.tab === "resolvidas" ? "closed" : "open",
    p_category: category,
    p_professional: f.professional || undefined,
    p_days: Number(f.period),
    p_sort: f.sort === "valor" ? "value" : f.sort === "data" ? "date" : "priority",
    p_limit: PAGE_SIZE * f.page,
    p_offset: 0,
  };
}

/** Monta a URL mantendo só o que difere do padrão (links limpos e compartilháveis). */
export function filtersQuery(f: Filters, patch: Partial<Filters> = {}): string {
  const next = { ...f, ...patch };
  const q = new URLSearchParams();
  if (next.tab !== "todas") q.set("tab", next.tab);
  if (next.period !== "14") q.set("periodo", next.period);
  if (next.sort !== "prioridade") q.set("ordem", next.sort);
  if (next.professional) q.set("profissional", next.professional);
  if (next.page > 1) q.set("pagina", String(next.page));
  const s = q.toString();
  return s ? `?${s}` : "";
}
