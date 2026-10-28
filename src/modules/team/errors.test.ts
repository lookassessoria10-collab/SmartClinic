import { describe, expect, it } from "vitest";
import { teamErrorMessage } from "./errors";

describe("teamErrorMessage", () => {
  it("traduz os motivos sinalizados pelo banco", () => {
    expect(teamErrorMessage({ hint: "already_member" })).toBe("Esta pessoa já faz parte da equipe.");
    expect(teamErrorMessage({ hint: "org_read_only" })).toMatch(/somente leitura/);
  });

  it("reconhece o gatilho de último gestor mesmo sem hint", () => {
    expect(teamErrorMessage({ code: "P0001", message: "A clínica precisa de pelo menos um gestor ativo." })).toMatch(/gestor ativo/);
  });

  it("sem permissão vira mensagem clara", () => {
    expect(teamErrorMessage({ code: "42501" })).toBe("Você não tem permissão para esta ação.");
  });

  it("erro desconhecido não vaza detalhes técnicos", () => {
    expect(teamErrorMessage({ code: "XX000", message: "relation foo does not exist" })).toMatch(/Tente de novo/);
  });
});
