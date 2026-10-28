import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("aceita caminhos internos e preserva busca e âncora", () => {
    expect(safeNextPath("/c/clinica-aurora/agenda")).toBe("/c/clinica-aurora/agenda");
    expect(safeNextPath("/c/x/agenda?novo=1#topo")).toBe("/c/x/agenda?novo=1#topo");
  });

  it.each([
    ["https://site-malicioso.test"],
    ["//site-malicioso.test"],
    ["/\\site-malicioso.test"],
    ["\\\\site-malicioso.test"],
    ["javascript:alert(1)"],
    ["/c/x\nSet-Cookie: a=b"],
    ["c/sem-barra"],
    [""],
    [null],
    [42],
  ])("recusa %j", (value) => {
    expect(safeNextPath(value, "/inicio")).toBe("/inicio");
  });
});
