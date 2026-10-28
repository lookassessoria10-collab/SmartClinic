import { expect, test } from "@playwright/test";
import { freshTotp, login, logout, signUpWithClinic, uniqueEmail } from "./helpers";

// Conta própria do teste: ativar MFA nos usuários do seed afetaria os outros testes.
test("MFA: ativar, login pede o código, endereço direto não pula o código", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("mfa");
  const password = "Mfa@E2E-2026-teste";
  const slug = await signUpWithClinic(page, { name: "Gestor MFA", email, password, clinic: `Clínica MFA ${Date.now()}` });

  await page.goto(`/c/${slug}/conta`);
  await page.getByRole("button", { name: "Ativar verificação em duas etapas" }).click();
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  const secret = (await page.locator("code").textContent())!.trim();

  await page.getByLabel("Código").fill("000000");
  await page.getByRole("button", { name: "Confirmar e ativar" }).click();
  await expect(page.getByText("Código incorreto. Use o código que aparece agora no aplicativo.")).toBeVisible();

  await page.getByLabel("Código").fill(await freshTotp(secret));
  await page.getByRole("button", { name: "Confirmar e ativar" }).click();
  await expect(page.getByText("Ativada", { exact: true })).toBeVisible();

  await logout(page);
  await login(page, email, password);
  await expect(page).toHaveURL(/\/login\/mfa/);

  // Tentar pular o segundo passo digitando o endereço.
  await page.goto(`/c/${slug}/inicio`);
  await expect(page).toHaveURL(/\/login\/mfa\?next=/);

  await page.getByLabel("Código").fill("111111");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText(/Código incorreto ou expirado/)).toBeVisible();

  await page.getByLabel("Código").fill(await freshTotp(secret));
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${slug}/inicio`));
});
