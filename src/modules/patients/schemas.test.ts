import { describe, expect, it } from "vitest";
import { patientSchema } from "./schemas";

describe("patientSchema", () => {
  it("normaliza o celular para E.164", () => {
    expect(patientSchema.parse({ name: "Mariana Alves", phone: "(11) 90000-1234" }).phone).toBe("+5511900001234");
  });
  it("telefone é opcional", () => {
    expect(patientSchema.parse({ name: "Mariana Alves", email: "m@exemplo.test" }).phone).toBeNull();
  });
  it("recusa celular sem DDD com mensagem no campo", () => {
    const r = patientSchema.safeParse({ name: "Mariana Alves", phone: "90000-1234" });
    expect(r.error?.issues[0]).toMatchObject({ path: ["phone"], message: "Informe um celular com DDD." });
  });
  it("recusa nome curto e e-mail inválido", () => {
    expect(patientSchema.safeParse({ name: "Ma" }).success).toBe(false);
    expect(patientSchema.safeParse({ name: "Mariana", email: "mariana" }).success).toBe(false);
  });
  it("recusa nascimento no futuro ou antes de 1900", () => {
    expect(patientSchema.safeParse({ name: "Mariana", birthDate: "2999-01-01" }).success).toBe(false);
    expect(patientSchema.safeParse({ name: "Mariana", birthDate: "1899-12-31" }).success).toBe(false);
    expect(patientSchema.safeParse({ name: "Mariana", birthDate: "1990-05-10" }).success).toBe(true);
  });
});
