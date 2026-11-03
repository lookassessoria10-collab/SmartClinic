import { describe, expect, it } from "vitest";
import { CHAPTERS, SLIDES } from "./content";
import { chapterGroups, deckSlides, hashFor, matchesQuery, parseHash } from "./route";

describe("endereço das lâminas", () => {
  it("#s/N abre a apresentação completa na lâmina N (com limite)", () => {
    expect(parseHash("#s/3")).toEqual({ mode: "deck", trail: null, index: 2 });
    expect(parseHash("#s/999")).toEqual({ mode: "deck", trail: null, index: SLIDES.length - 1 });
    expect(parseHash("#s/0")).toEqual({ mode: "deck", trail: null, index: 0 });
  });

  it("#t/perfil/N abre a trilha; perfil desconhecido volta para a página inicial", () => {
    expect(parseHash("#t/recepcao/2")).toMatchObject({ mode: "deck", trail: "recepcao", index: 1 });
    expect(parseHash("#t/admin/1")).toEqual({ mode: "home", anchor: "t/admin/1" });
    expect(parseHash("#trilhas")).toEqual({ mode: "home", anchor: "trilhas" });
  });

  it("ida e volta do endereço", () => {
    expect(parseHash(hashFor("profissional", 4))).toMatchObject({ trail: "profissional", index: 4 });
    expect(hashFor(null, 0)).toBe("#s/1");
  });
});

describe("roteiro", () => {
  it("toda lâmina tem id único, capítulo válido e ao menos um perfil", () => {
    expect(new Set(SLIDES.map((s) => s.id)).size).toBe(SLIDES.length);
    for (const s of SLIDES) {
      expect(CHAPTERS[s.chapter], s.id).toBeDefined();
      expect(s.profiles.length, s.id).toBeGreaterThan(0);
    }
  });

  it("capítulos em ordem, sem voltar atrás (barra de progresso contínua)", () => {
    const order = chapterGroups(SLIDES).map((g) => g.chapter.n);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
  });

  it("toda trilha começa pela capa e termina no encerramento", () => {
    for (const p of ["gestao", "recepcao", "profissional"] as const) {
      const t = deckSlides(p);
      expect(t[0].id).toBe("capa");
      expect(t.at(-1)?.id).toBe("encerramento");
      expect(t.length).toBeLessThanOrEqual(SLIDES.length);
    }
  });

  it("busca do sumário ignora acento e caixa", () => {
    const seg = SLIDES.find((s) => s.id === "seguranca" || s.id === "isolamento")!;
    expect(matchesQuery(seg, "SEGURANCA")).toBe(true);
    expect(matchesQuery(seg, "xyz-nada")).toBe(false);
    expect(matchesQuery(seg, "")).toBe(true);
  });
});
