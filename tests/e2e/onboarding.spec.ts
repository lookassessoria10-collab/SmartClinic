import { expect, test } from "@playwright/test";
import { signUpWithClinic, uniqueEmail } from "./helpers";

test("cadastro → confirmação por e-mail → onboarding cria a clínica", async ({ page }) => {
  const email = uniqueEmail("gestora");
  const slug = await signUpWithClinic(page, {
    name: "Gestora E2E",
    email,
    password: "Gestora@E2E-2026",
    clinic: `Clínica E2E ${Date.now()}`,
  });

  // Nome e papel reais na casca.
  await expect(page.getByRole("heading", { name: /Gestora/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Conta: Gestora E2E\s*Gestora/ }).first()).toBeVisible();

  // Clínica de outra pessoa: mesma resposta de endereço inexistente.
  await page.goto("/c/clinica-aurora/inicio");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();

  // A própria continua acessível.
  await page.goto(`/c/${slug}/gestao/equipe`);
  await expect(page.getByRole("heading", { name: "Equipe" })).toBeVisible();
});
