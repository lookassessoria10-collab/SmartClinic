import { expect, test } from "@playwright/test";
import { SEED, login, uniqueEmail, waitForEmailLink } from "./helpers";

test("gestora convida, pessoa nova cria a senha e entra com o papel convidado", async ({ page, browser }) => {
  const invited = uniqueEmail("profissional");
  const name = `Convidada E2E ${Date.now()}`; // único: execuções anteriores deixam pessoas na equipe

  await login(page, SEED.ana, SEED.password, "/c/clinica-aurora/gestao/equipe");
  await expect(page.getByRole("heading", { name: "Equipe" })).toBeVisible();
  // getByRole ignora elementos ocultos (o Next mantém a rota anterior, o login, escondida no DOM).
  await page.getByRole("textbox", { name: "E-mail", exact: true }).fill(invited);
  await page.getByRole("combobox", { name: "Papel", exact: true }).selectOption("professional");
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText(`Convite enviado para ${invited}.`)).toBeVisible();

  // A pessoa convidada abre o link em outro navegador (sem a sessão da gestora).
  const { subject, link } = await waitForEmailLink(invited, /convidado/);
  expect(subject).toBe("Você foi convidado(a) para uma clínica");
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(link);
  await expect(guest.getByRole("heading", { name: "Convite: Clínica Aurora" })).toBeVisible();
  await expect(guest.getByText("Profissional — Os próprios atendimentos e pacientes.")).toBeVisible();
  await guest.getByLabel("Seu nome completo").fill(name);
  await guest.getByLabel("Crie uma senha").fill("Convidada@E2E-2026");
  await guest.getByRole("button", { name: "Aceitar e entrar na clínica" }).click();
  await expect(guest).toHaveURL(/\/c\/clinica-aurora\/inicio/);
  await expect(guest.getByRole("button", { name: new RegExp(`^Conta: ${name}\\s*Profissional`) }).first()).toBeVisible();

  // O mesmo link não serve de novo.
  await guest.goto(new URL(link).searchParams.get("next")!);
  await expect(guest.getByRole("heading", { name: "Convite indisponível" })).toBeVisible();

  // A gestora vê a pessoa na equipe.
  await page.reload();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
});

test("a única gestora não pode deixar de ser gestora", async ({ page }) => {
  await login(page, SEED.ana, SEED.password, "/c/clinica-aurora/gestao/equipe");
  const role = page.getByRole("combobox", { name: "Papel de Dra. Ana Ribeiro" });
  await role.selectOption("reception");
  await expect(page.getByText("A clínica precisa de pelo menos um gestor ativo. Promova outra pessoa antes.")).toBeVisible();
  await expect(role).toHaveValue("manager");
});
