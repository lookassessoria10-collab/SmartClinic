import { expect, test } from "@playwright/test";
import { SEED, login, logout, uniqueEmail } from "./helpers";

test.describe("autenticação", () => {
  test("área da clínica exige login e volta ao destino depois de entrar", async ({ page }) => {
    await page.goto("/c/clinica-aurora/agenda");
    await expect(page).toHaveURL(/\/login\?next=%2Fc%2Fclinica-aurora%2Fagenda/);

    await page.getByLabel("E-mail").fill(SEED.ana);
    await page.getByLabel("Senha", { exact: true }).fill(SEED.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/c\/clinica-aurora\/agenda/);

    await logout(page);
    await page.goto("/c/clinica-aurora/inicio");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("senha errada recebe mensagem genérica (não revela se o e-mail existe)", async ({ page }) => {
    await login(page, uniqueEmail("ninguem"), "senha-qualquer-123");
    // Filtrado: o anunciador de rotas do Next também tem role="alert".
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." })).toBeVisible();
  });

  test("sessão em cookie HttpOnly e cabeçalhos de segurança", async ({ page, context, request }) => {
    await login(page, SEED.ana, SEED.password);
    await expect(page).toHaveURL(/\/c\/clinica-aurora\/inicio/);
    const session = (await context.cookies()).find((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
    expect(session, "cookie de sessão do Supabase").toBeTruthy();
    expect(session!.httpOnly, "JavaScript da página não pode ler o token").toBe(true);
    expect(session!.sameSite).toBe("Lax");

    const res = await request.get("/login");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers()["x-powered-by"]).toBeUndefined();

    const invite = await request.get("/convite/codigo-qualquer");
    expect(invite.headers()["referrer-policy"]).toBe("no-referrer");
  });

  test("recepção não acessa Gestão, nem pelo endereço", async ({ page }) => {
    await login(page, SEED.bruno, SEED.password);
    await expect(page).toHaveURL(/\/c\/clinica-aurora\/inicio/);
    await expect(page.getByRole("navigation", { name: "Principal" }).first().getByRole("link", { name: "Gestão" })).toHaveCount(0);
    await page.goto("/c/clinica-aurora/gestao/equipe");
    await expect(page.getByText("Você não tem acesso a esta área")).toBeVisible();
  });
});
