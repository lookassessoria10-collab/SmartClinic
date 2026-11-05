import { describe, expect, it } from "vitest";
import { csvRow, entryFiltersQuery, parseEntryFilters, periodRange, seriesLabel, situation } from "./model";
import { entrySchema, modulesSchema, parseMoney } from "./schemas";

const TODAY = new Date("2026-11-05T12:00:00");
const CAT = "11111111-1111-4111-8111-111111111111";

describe("valores", () => {
  it.each([
    ["150", 15000],
    ["150,5", 15050],
    ["1.250,90", 125090],
    ["R$ 2.000,00", 200000],
    ["", null],
    ["abc", null],
  ])("%j → %j centavos", (input, cents) => expect(parseMoney(input)).toBe(cents));
});

describe("período e filtros", () => {
  it("mês atual, mês passado e ano", () => {
    expect(periodRange("mes", TODAY)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodRange("mes-anterior", TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("ano", TODAY)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("personalizado: datas trocadas são corrigidas e o período tem no máximo 2 anos", () => {
    expect(periodRange("personalizado", TODAY, { from: "2026-12-10", to: "2026-12-01" })).toEqual({ from: "2026-12-01", to: "2026-12-10" });
    expect(periodRange("personalizado", TODAY, { from: "2020-01-01", to: "2026-01-01" }).to).toBe("2022-01-01");
  });

  it("valores desconhecidos na URL viram o padrão; URL limpa", () => {
    const f = parseEntryFilters({ periodo: "xyz", tipo: "drop", status: "?", categoria: "nao-uuid", q: "  aluguel " }, TODAY);
    expect(f).toMatchObject({ period: "mes", type: "todos", status: "todos", category: "", q: "aluguel" });
    expect(entryFiltersQuery(f)).toBe("?q=aluguel");
    expect(entryFiltersQuery(f, { type: "despesas", status: "atrasados" })).toBe("?tipo=despesas&status=atrasados&q=aluguel");
  });
});

describe("situação", () => {
  it("pendente vencido aparece como atrasado; pago e cancelado não mudam", () => {
    expect(situation({ status: "pending", dueDate: "2026-11-01" }, "2026-11-05")).toBe("overdue");
    expect(situation({ status: "pending", dueDate: "2026-11-05" }, "2026-11-05")).toBe("pending");
    expect(situation({ status: "paid", dueDate: "2026-10-01" }, "2026-11-05")).toBe("paid");
  });

  it("rótulo de parcela e de repetição mensal", () => {
    expect(seriesLabel({ repeatKind: "installments", installment: 2, installments: 3 })).toBe("Parcela 2 de 3");
    expect(seriesLabel({ repeatKind: "monthly", installment: 1, installments: 12 })).toBe("Mensal 1 de 12");
    expect(seriesLabel({ repeatKind: null, installment: null, installments: null })).toBeNull();
  });
});

describe("CSV", () => {
  it("separa por ponto e vírgula, protege aspas e impede fórmula no Excel", () => {
    expect(csvRow(["Receita", "Consulta; retorno", 'Dr. "Zé"', "-150,00"])).toBe('Receita;"Consulta; retorno";"Dr. ""Zé""";-150,00');
    expect(csvRow(["=HYPERLINK(1)", "@cmd", "+x"])).toBe("'=HYPERLINK(1);'@cmd;'+x");
  });
});

describe("validação", () => {
  const base = { type: "income" as const, categoryId: CAT, description: "Consulta", amount: "150,00", dueDate: "2026-11-05", paid: false };

  it("valor obrigatório e maior que zero", () => {
    expect(entrySchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(entrySchema.parse(base)).toMatchObject({ amountCents: 15000, paidAt: null, method: null });
  });

  it("pago exige data; repetição de 2 a 60", () => {
    expect(entrySchema.safeParse({ ...base, paid: true, paidAt: "" }).success).toBe(false);
    expect(entrySchema.safeParse({ ...base, repeat: "installments", count: 1 }).success).toBe(false);
    expect(entrySchema.safeParse({ ...base, repeat: "monthly", count: 12 }).success).toBe(true);
  });

  it("módulos: ao menos um, Oportunidades só com Agenda", () => {
    expect(modulesSchema.safeParse(["finance"]).success).toBe(true);
    expect(modulesSchema.safeParse([]).success).toBe(false);
    expect(modulesSchema.safeParse(["opportunities", "finance"]).success).toBe(false);
  });
});
