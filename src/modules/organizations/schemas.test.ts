import { describe, expect, it } from "vitest";
import { onboardingSchema, slugify, slugProblem } from "./schemas";

describe("slugify", () => {
  it.each([
    ["Clínica São José", "clinica-sao-jose"],
    ["  Espaço   Lumi!! ", "espaco-lumi"],
    ["Odonto & Cia — Unidade 2", "odonto-cia-unidade-2"],
    ["---", ""],
  ])("%j → %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("limita a 48 caracteres sem terminar em hífen", () => {
    const s = slugify("a".repeat(47) + " bbbb");
    expect(s.length).toBeLessThanOrEqual(48);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("slugProblem", () => {
  it("aceita endereço válido", () => expect(slugProblem("clinica-aurora")).toBeNull());
  it.each(["ab", "Com-Maiuscula", "-inicio", "fim-", "dois--hifens", "admin", "com espaço"])("recusa %j", (s) => {
    expect(slugProblem(s)).not.toBeNull();
  });
});

describe("onboardingSchema", () => {
  const valid = {
    name: "Clínica Teste", slug: "clinica-teste", segment: "dental_clinic", size: "2 a 5",
    services: ["Avaliação"], modules: ["schedule", "finance"], attends: true, specialty: "Dentista",
  };

  it("aceita um onboarding completo", () => {
    expect(onboardingSchema.safeParse(valid).success).toBe(true);
  });

  it("recusa segmento fora da lista", () => {
    expect(onboardingSchema.safeParse({ ...valid, segment: "hospital" }).success).toBe(false);
  });

  it("com Agenda, exige ao menos um serviço", () => {
    expect(onboardingSchema.safeParse({ ...valid, services: [] }).success).toBe(false);
  });

  it("só Financeiro: não pede equipe nem serviços", () => {
    const onlyFinance = { name: valid.name, slug: valid.slug, segment: valid.segment, modules: ["finance"] };
    expect(onboardingSchema.safeParse(onlyFinance).success).toBe(true);
  });

  it("exige ao menos um módulo e Oportunidades só com Agenda", () => {
    expect(onboardingSchema.safeParse({ ...valid, modules: [] }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, modules: ["opportunities", "finance"] }).success).toBe(false);
  });
});
