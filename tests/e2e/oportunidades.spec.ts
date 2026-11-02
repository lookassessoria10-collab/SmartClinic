import { expect, test, type Page } from "@playwright/test";
import { SEED, login } from "./helpers";

// Módulo Oportunidades (docs/17) com o seed da Clínica Aurora (Dra. Ana, gestora).
const BASE = "/c/clinica-aurora/inicio/oportunidades";

async function newPatient(page: Page, name: string, digits: string) {
  await page.goto("/c/clinica-aurora/pacientes");
  await page.getByRole("button", { name: "Novo paciente" }).click();
  await page.getByRole("textbox", { name: "Nome completo" }).fill(name);
  await page.getByRole("textbox", { name: "Celular" }).fill(`11 9${digits}`);
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page.getByRole("button", { name })).toBeVisible();
}

test.describe("oportunidades", () => {
  test("tela mostra indicadores, filtros e horários livres da agenda real", async ({ page }) => {
    await login(page, SEED.ana, SEED.password, BASE);
    await expect(page.getByRole("heading", { level: 1, name: "Oportunidades" })).toBeVisible();
    const indicators = page.getByRole("region", { name: "Indicadores" });
    await expect(indicators.getByText("Receita potencial em risco")).toBeVisible();
    await expect(indicators.getByText("Horários disponíveis")).toBeVisible();

    await page.getByRole("navigation", { name: "Categorias" }).getByRole("link", { name: /^Agenda/ }).click();
    await expect(page).toHaveURL(/tab=agenda/);
    await expect(page.getByRole("article").filter({ hasText: /horários? livres?/ }).first()).toBeVisible();

    // Detalhes: como o valor foi calculado e o histórico, sem botão sem ação.
    await page.getByRole("article").filter({ hasText: /horários? livres?/ }).first().getByRole("button", { name: /Detalhes/ }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByText("Como calculamos").click();
    await expect(sheet.getByText(/não é faturamento garantido/)).toBeVisible();
    await expect(sheet.getByText("Identificada pelo sistema")).toBeVisible();
  });

  test("cancelamento libera o horário, a lista de espera sugere o paciente e agendar resolve", async ({ page }) => {
    test.setTimeout(150_000);
    const stamp = Date.now();
    const first = `Cancela E2E ${stamp}`;
    const waiting = `Espera E2E ${stamp}`;
    await login(page, SEED.ana, SEED.password, "/c/clinica-aurora/inicio");
    await newPatient(page, first, String(stamp).slice(-8));
    await newPatient(page, waiting, String(stamp + 1).slice(-8));

    // Agenda o primeiro paciente e desfaz (cancela) logo em seguida.
    await page.goto("/c/clinica-aurora/agenda?novo=1");
    const sheet = page.getByRole("dialog", { name: "Novo agendamento" });
    await sheet.getByRole("combobox", { name: "Paciente" }).fill(first);
    await sheet.getByRole("option", { name: new RegExp(`^${first}`) }).click();
    const horario = sheet.getByRole("combobox", { name: "Horário" });
    const escolhido = await horario.evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text ?? "");
    if (!/^\d\d:\d\d$/.test(escolhido)) await horario.selectOption({ index: 1 });
    const hora = await horario.evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex].text);
    await sheet.getByRole("button", { name: "Agendar" }).click();
    await expect(page.getByText(new RegExp(`Agendado: ${first}`))).toBeVisible();
    const undone = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/agenda"));
    await page.getByRole("button", { name: "Desfazer" }).click();
    await undone;

    // Segundo paciente entra na lista de espera, sem preferência de horário.
    await page.goto(`${BASE}/espera`);
    await page.getByRole("button", { name: "Adicionar à lista" }).click();
    const form = page.getByRole("dialog", { name: "Adicionar à lista de espera" });
    await form.getByRole("combobox", { name: "Paciente" }).fill(waiting);
    await form.getByRole("option", { name: new RegExp(`^${waiting}`) }).click();
    await form.getByRole("button", { name: "Adicionar à lista" }).click();
    await expect(page.getByText(`${waiting} entrou na lista de espera.`)).toBeVisible();

    // O horário liberado aparece com a sugestão; agendar a partir dela preenche tudo.
    await page.goto(`${BASE}?tab=agenda`);
    const card = page.getByRole("article").filter({ hasText: "Horário liberado" }).filter({ hasText: `às ${hora}` }).first();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: /Ver sugestões/ }).click();
    const detail = page.getByRole("dialog");
    await expect(detail.getByText(waiting)).toBeVisible();
    await detail.getByRole("listitem").filter({ hasText: waiting }).getByRole("link", { name: /^Agendar às/ }).click();

    const booking = page.getByRole("dialog", { name: "Novo agendamento" });
    await expect(booking.getByText(waiting)).toBeVisible();
    await booking.getByRole("button", { name: "Agendar" }).click();
    await expect(page.getByText(new RegExp(`Agendado: ${waiting}`))).toBeVisible();

    // Resolvida por quem agendou; o paciente saiu da lista de espera.
    await page.goto(`${BASE}?tab=resolvidas`);
    await expect(page.getByRole("article").filter({ hasText: "Horário liberado" }).filter({ hasText: `às ${hora}` }).first()).toContainText("Resolvida");
    await page.goto(`${BASE}/espera`);
    await expect(page.getByText(waiting)).toHaveCount(0);
  });

  test("descartar exige motivo e fica no histórico", async ({ page }) => {
    await login(page, SEED.ana, SEED.password, `${BASE}?tab=agenda`);
    const card = page.getByRole("article").filter({ hasText: /horários? livres?/ }).last();
    await card.getByRole("button", { name: /Detalhes/ }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Descartar", exact: true }).click();
    await sheet.getByRole("button", { name: "Descartar", exact: true }).click();
    await expect(sheet.getByText("Informe o motivo do descarte.")).toBeVisible();
    await sheet.getByRole("textbox", { name: "Motivo do descarte" }).fill("Horário reservado para reunião");
    await sheet.getByRole("button", { name: "Descartar", exact: true }).click();
    await expect(page.getByText("Oportunidade descartada.")).toBeVisible();

    await page.goto(`${BASE}?tab=resolvidas`);
    const closed = page.getByRole("article").filter({ hasText: "Motivo: Horário reservado para reunião" }).first();
    await expect(closed).toContainText("Descartada");
    await closed.getByRole("button", { name: /Detalhes/ }).click();
    await expect(page.getByRole("dialog").getByText("Horário reservado para reunião").first()).toBeVisible();
  });
});
