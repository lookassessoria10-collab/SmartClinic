import { expect, test } from "@playwright/test";
import { SEED, login, signUpWithClinic, uniqueEmail } from "./helpers";

// Módulos e Financeiro (migração 0016, docs/19).
test.describe("módulos e financeiro", () => {
  test("clínica só com Financeiro: menu enxuto, receitas, despesas, relatório e CSV", async ({ page }) => {
    test.setTimeout(150_000);
    const slug = await signUpWithClinic(page, {
      name: "Gestora Fin",
      email: uniqueEmail("financeiro"),
      password: "Financeiro@E2E-2026",
      clinic: `Clínica Fin ${Date.now()}`,
      modules: ["finance"],
    });
    const base = `/c/${slug}`;

    // Menu só com o que foi escolhido.
    const nav = page.getByRole("navigation", { name: "Principal" }).first();
    await expect(nav.getByRole("link", { name: "Financeiro" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Agenda" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Pacientes" })).toHaveCount(0);
    await page.goto(`${base}/agenda`);
    await expect(page.getByText("Este módulo está desligado")).toBeVisible();

    // Receita recebida.
    await page.goto(`${base}/financeiro`);
    await page.getByRole("button", { name: "Nova receita" }).click();
    let sheet = page.getByRole("dialog", { name: "Nova receita" });
    await sheet.getByRole("textbox", { name: "Descrição" }).fill("Consulta particular");
    await sheet.getByRole("textbox", { name: "Valor (R$)" }).fill("250,00");
    await sheet.getByText("Já foi recebido").click();
    await sheet.getByRole("button", { name: "Lançar receita" }).click();
    await expect(page.getByText("Receita lançada.")).toBeVisible();

    // Despesa mensal (3 meses), a primeira paga depois.
    await page.getByRole("button", { name: "Nova despesa" }).click();
    sheet = page.getByRole("dialog", { name: "Nova despesa" });
    await sheet.getByRole("textbox", { name: "Descrição" }).fill("Aluguel da sala");
    await sheet.getByRole("textbox", { name: "Valor (R$)" }).fill("1.200,00");
    await sheet.getByRole("combobox", { name: "Categoria" }).selectOption({ label: "Aluguel" });
    await sheet.getByRole("combobox", { name: "Repetir" }).selectOption("monthly");
    await sheet.getByRole("textbox", { name: "Quantos meses" }).fill("3");
    await sheet.getByRole("button", { name: "Lançar despesa" }).click();
    await expect(page.getByText("Despesa lançada.")).toBeVisible();
    await expect(page.getByText(/Mensal 1 de 3/)).toBeVisible();

    await page.getByRole("button", { name: "Pagar: Aluguel da sala" }).click();
    await page.getByRole("dialog", { name: "Registrar pagamento" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Pagamento registrado.")).toBeVisible();

    const summary = page.getByRole("region", { name: "Resumo do período" });
    await expect(summary).toContainText("R$ 250,00");
    await expect(summary).toContainText("R$ 1.200,00");
    await expect(summary).toContainText("R$ 950,00");

    // Relatório e exportação.
    await page.getByRole("navigation", { name: "Áreas do Financeiro" }).getByRole("link", { name: "Relatório" }).click();
    await expect(page.getByRole("heading", { name: "Relatório financeiro" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Despesas por categoria" })).toContainText("Aluguel");
    const csvHref = await page.getByRole("link", { name: "Exportar CSV" }).getAttribute("href");
    const csv = await page.request.get(csvHref!);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("Consulta particular");

    // Ligar a Agenda depois: aparece no menu.
    await page.goto(`${base}/gestao/modulos`);
    await page.getByText("Agenda e pacientes", { exact: true }).click();
    await page.getByRole("button", { name: "Salvar módulos" }).click();
    await expect(page.getByText("Módulos atualizados.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Principal" }).first().getByRole("link", { name: "Agenda" })).toBeVisible();
  });

  test("recepção lança receitas, mas não vê despesas nem relatório", async ({ page }) => {
    await login(page, SEED.bruno, SEED.password, "/c/clinica-aurora/financeiro");
    await expect(page.getByRole("heading", { name: "Financeiro" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova receita" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova despesa" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Resumo do período" })).toHaveCount(0);
    await page.goto("/c/clinica-aurora/financeiro/relatorio");
    await expect(page.getByText("Você não tem acesso a esta área")).toBeVisible();
  });
});
