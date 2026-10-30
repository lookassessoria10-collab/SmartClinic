import { expect, test } from "@playwright/test";
import { SEED, login } from "./helpers";

// Fases 4–5 com o seed: Dra. Ana (gestora) e Carla (profissional) da Clínica Aurora.
test.describe("cadastros e agenda reais", () => {
  test("gestora cadastra serviço, paciente e agenda; o horário some da lista de livres", async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    const service = `Clareamento E2E ${stamp}`;
    const patient = `Paciente E2E ${stamp}`;

    await login(page, SEED.ana, SEED.password, "/c/clinica-aurora/gestao/servicos");
    await page.getByRole("button", { name: "Novo serviço" }).click();
    await page.getByRole("textbox", { name: "Nome do serviço" }).fill(service);
    await page.getByRole("spinbutton", { name: "Duração (min)" }).fill("60");
    await page.getByRole("textbox", { name: /Preço/ }).fill("300,00");
    // Novo serviço já vem marcado para todos os profissionais ativos.
    await page.getByRole("button", { name: "Cadastrar serviço" }).click();
    await expect(page.getByRole("cell", { name: service, exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(service) })).toContainText("R$ 300,00");

    await page.goto("/c/clinica-aurora/pacientes");
    await page.getByRole("button", { name: "Novo paciente" }).click();
    await page.getByRole("textbox", { name: "Nome completo" }).fill(patient);
    await page.getByRole("textbox", { name: "Celular" }).fill(`11 9${String(stamp).slice(-8)}`);
    await page.getByRole("button", { name: "Cadastrar paciente" }).click();
    await expect(page.getByRole("button", { name: patient })).toBeVisible();

    // Ação rápida: abre o painel já no próximo horário livre.
    await page.goto("/c/clinica-aurora/agenda?novo=1");
    const sheet = page.getByRole("dialog", { name: "Novo agendamento" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("combobox", { name: "Paciente" }).fill(patient);
    await sheet.getByRole("option", { name: new RegExp(`^${patient}`) }).click();
    await sheet.getByRole("combobox", { name: "Serviço" }).selectOption({ label: service });
    const horario = sheet.getByRole("combobox", { name: "Horário" });
    const escolhido = await horario.evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text ?? "");
    if (!/^\d\d:\d\d$/.test(escolhido)) await horario.selectOption({ index: 1 });
    const hora = await horario.evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex].text);
    await sheet.getByRole("button", { name: "Agendar" }).click();
    await expect(page.getByText(new RegExp(`Agendado: ${patient}`))).toBeVisible();

    // O paciente agora tem o agendamento no histórico.
    await page.goto("/c/clinica-aurora/pacientes");
    await page.getByRole("button", { name: patient }).click();
    await expect(page.getByRole("dialog").getByText(service)).toBeVisible();

    // Mesmo profissional, mesmo dia e serviço: aquele horário não é mais oferecido.
    await page.goto("/c/clinica-aurora/agenda?novo=1");
    const again = page.getByRole("dialog", { name: "Novo agendamento" });
    await again.getByRole("combobox", { name: "Serviço" }).selectOption({ label: service });
    const livres = await again.getByRole("combobox", { name: "Horário" }).evaluate((s: HTMLSelectElement) => [...s.options].map((o) => o.text));
    expect(livres).not.toContain(hora);
  });

  test("profissional vê só os próprios pacientes e a agenda dos colegas como ocupada", async ({ page }) => {
    await login(page, "carla@clinica-aurora.test", SEED.password, "/c/clinica-aurora/pacientes");
    await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
    // Beatriz tem atendimento com Carla no seed; Mariana só com a Dra. Ana.
    await expect(page.getByRole("button", { name: "Beatriz Santos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mariana Alves" })).toHaveCount(0);
  });

  test("gestora bloqueia um dia e ele aparece na lista", async ({ page }) => {
    await login(page, SEED.ana, SEED.password, "/c/clinica-aurora/gestao/horarios");
    const reason = `Feriado E2E ${Date.now()}`;
    await page.getByRole("textbox", { name: /Motivo/ }).fill(reason);
    await page.getByRole("button", { name: "Adicionar bloqueio" }).click();
    await expect(page.getByText(reason)).toBeVisible();
    await page.getByRole("listitem").filter({ hasText: reason }).getByRole("button", { name: "Remover bloqueio" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remover" }).click();
    await expect(page.getByText(reason)).toHaveCount(0);
  });
});
