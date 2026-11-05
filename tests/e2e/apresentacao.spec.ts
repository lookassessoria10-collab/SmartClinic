import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Apresentação pública (/apresentacao): sem login, navegável por teclado, sem violações do axe.
async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test.describe("apresentação pública", () => {
  test("abre sem login, navega pelas lâminas e pelo sumário", async ({ page }) => {
    await page.goto("/apresentacao");
    await expect(page).toHaveURL(/\/apresentacao/);
    await expect(page.getByRole("heading", { level: 1, name: "Conheça o smartclin" })).toBeVisible();
    expect(await axe(page), "página inicial").toEqual([]);

    await page.getByRole("button", { name: "Assistir apresentação" }).click();
    await expect(page).toHaveURL(/#s\/1$/);
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#s\/2$/);
    await expect(page.getByRole("heading", { name: /O que você vai conhecer/ })).toBeVisible();
    expect(await axe(page), "lâmina").toEqual([]);

    // Índice da lâmina leva ao capítulo.
    await page.getByRole("button", { name: /Oportunidades/ }).first().click();
    await expect(page.getByRole("heading", { name: /A central do que merece atenção/ })).toBeVisible();

    await page.getByRole("button", { name: "Abrir sumário" }).click();
    const toc = page.getByRole("dialog", { name: "Sumário" });
    await expect(toc).toBeVisible();
    expect(await axe(page), "sumário").toEqual([]);
    await toc.getByRole("searchbox").fill("seguranca");
    await toc.getByRole("button", { name: /Cada clínica isolada/ }).click();
    await expect(toc).toBeHidden();
    await expect(page.getByRole("heading", { name: /nunca aparecem em outra/ })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 1, name: "Conheça o smartclin" })).toBeVisible();
  });

  test("trilha por perfil, cartões que viram e teste rápido", async ({ page }) => {
    await page.goto("/apresentacao#trilhas");
    await page.getByRole("button", { name: /Começar trilha recepção/ }).click();
    await expect(page).toHaveURL(/#t\/recepcao\/1$/);
    await expect(page.getByText(/trilha Recepção/).first()).toBeVisible();
    await page.getByRole("button", { name: "Sair da apresentação" }).click();

    const card = page.getByRole("button", { name: /Antes · Agenda/ });
    await expect(card).toHaveAttribute("aria-pressed", "false");
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");

    const quiz = page.getByRole("region", { name: "Você já entendeu as regras?" });
    await quiz.getByRole("radio", { name: /Só Início, Financeiro e Gestão/ }).check();
    await quiz.getByRole("button", { name: "Confirmar" }).click();
    await expect(quiz.getByText("Isso!")).toBeVisible();
    await quiz.getByRole("button", { name: "Próxima pergunta" }).click();
    await quiz.getByRole("radio", { name: /Só uma consegue/ }).check();
    await quiz.getByRole("button", { name: "Confirmar" }).click();
    await expect(quiz.getByText("Isso!")).toBeVisible();
  });

  test("celular: sem violações e sem rolagem horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const path of ["/apresentacao", "/apresentacao#s/18"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
      expect(await axe(page), path).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path}: rolagem horizontal`).toBeLessThanOrEqual(0);
    }
  });
});
