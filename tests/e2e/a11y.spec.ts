import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SEED, login } from "./helpers";

// docs/12 §8, critério 10: telas novas da fase sem violações do axe (WCAG 2.2 A/AA).
async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("telas públicas sem violações", async ({ page }) => {
  for (const path of ["/login", "/cadastro", "/redefinir-senha", "/convite/codigo-qualquer"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await axe(page), path).toEqual([]);
  }
});

test("telas da clínica, Gestão e Minha conta sem violações", async ({ page }) => {
  await login(page, SEED.ana, SEED.password);
  await expect(page).toHaveURL(/\/c\/clinica-aurora\/inicio/);
  for (const path of [
    "inicio", "agenda", "pacientes", "gestao/profissionais", "gestao/servicos", "gestao/horarios", "gestao/equipe", "gestao/clinica",
    "gestao/auditoria", "conta", "inicio/oportunidades", "inicio/oportunidades/espera", "inicio/oportunidades/retornos",
    "inicio/oportunidades/orcamentos", "gestao/oportunidades", "financeiro", "financeiro/relatorio", "financeiro/categorias", "gestao/modulos",
  ]) {
    await page.goto(`/c/clinica-aurora/${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await axe(page), path).toEqual([]);
  }
});

test("Oportunidades no celular: sem violações e sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, SEED.ana, SEED.password);
  await expect(page).toHaveURL(/\/c\/clinica-aurora\/inicio/);
  for (const path of ["inicio/oportunidades", "inicio/oportunidades/orcamentos"]) {
    await page.goto(`/c/clinica-aurora/${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await axe(page), path).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path}: rolagem horizontal`).toBeLessThanOrEqual(0);
  }
});
