import { describe, expect, it } from "vitest";
import { blockSchema, parsePrice, professionalSchema, serviceSchema, weeklyRulesSchema } from "./schemas";

describe("parsePrice", () => {
  it.each([
    ["150", 15000],
    ["150,5", 15050],
    ["150,00", 15000],
    ["R$ 89,90", 8990],
    ["0", 0],
    ["", null],
    ["  ", null],
  ])("%j → %j", (input, cents) => expect(parsePrice(input)).toBe(cents));

  it.each(["abc", "1.000,00", "-5", "10,999", "99999999"])("recusa %j", (input) => expect(parsePrice(input)).toBeUndefined());
});

describe("serviceSchema", () => {
  const base = { name: "Avaliação", durationMin: "30", professionalIds: [] };

  it("converte duração e preço", () => {
    const r = serviceSchema.parse({ ...base, price: "150,00", bufferAfterMin: "10" });
    expect(r).toMatchObject({ durationMin: 30, bufferAfterMin: 10, priceCents: 15000 });
  });

  it("sem preço é permitido", () => expect(serviceSchema.parse(base).priceCents).toBeNull());

  it("recusa preço mal escrito com mensagem no campo", () => {
    const r = serviceSchema.safeParse({ ...base, price: "dez reais" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["price"]);
  });

  it.each(["0", "4", "721"])("recusa duração %s", (d) => expect(serviceSchema.safeParse({ ...base, durationMin: d }).success).toBe(false));
});

describe("professionalSchema", () => {
  it("conta vazia vira null (profissional que não usa o sistema)", () => {
    expect(professionalSchema.parse({ name: "Dr. Marcos", userId: "" }).userId).toBeNull();
  });
  it("recusa cor fora da paleta", () => {
    expect(professionalSchema.safeParse({ name: "Dr. Marcos", color: 9 }).success).toBe(false);
  });
  it("recusa id de serviço inválido", () => {
    expect(professionalSchema.safeParse({ name: "Dr. Marcos", serviceIds: ["x"] }).success).toBe(false);
  });
});

describe("weeklyRulesSchema", () => {
  it("aceita manhã e tarde no mesmo dia", () => {
    expect(weeklyRulesSchema.safeParse([
      { weekday: 1, start: "08:00", end: "12:00" },
      { weekday: 1, start: "13:00", end: "18:00" },
    ]).success).toBe(true);
  });
  it("encostar não é sobreposição", () => {
    expect(weeklyRulesSchema.safeParse([
      { weekday: 1, start: "08:00", end: "12:00" },
      { weekday: 1, start: "12:00", end: "18:00" },
    ]).success).toBe(true);
  });
  it("recusa faixas sobrepostas no mesmo dia", () => {
    const r = weeklyRulesSchema.safeParse([
      { weekday: 2, start: "08:00", end: "12:00" },
      { weekday: 2, start: "11:00", end: "14:00" },
    ]);
    expect(r.error?.issues[0]?.message).toBe("Há faixas sobrepostas no mesmo dia.");
  });
  it("mesmo horário em dias diferentes é permitido", () => {
    expect(weeklyRulesSchema.safeParse([
      { weekday: 2, start: "08:00", end: "12:00" },
      { weekday: 3, start: "08:00", end: "12:00" },
    ]).success).toBe(true);
  });
  it("recusa fim antes do início e hora inválida", () => {
    expect(weeklyRulesSchema.safeParse([{ weekday: 1, start: "12:00", end: "08:00" }]).success).toBe(false);
    expect(weeklyRulesSchema.safeParse([{ weekday: 1, start: "24:00", end: "25:00" }]).success).toBe(false);
    expect(weeklyRulesSchema.safeParse([{ weekday: 7, start: "08:00", end: "09:00" }]).success).toBe(false);
  });
});

describe("blockSchema", () => {
  const b = { professionalId: "", kind: "holiday" as const, startsAt: "2026-12-25T03:00:00.000Z", endsAt: "2026-12-26T03:00:00.000Z" };
  it("sem profissional = clínica inteira", () => expect(blockSchema.parse(b).professionalId).toBeNull());
  it("recusa fim antes do início", () => {
    expect(blockSchema.safeParse({ ...b, endsAt: "2026-12-24T03:00:00.000Z" }).success).toBe(false);
  });
});
