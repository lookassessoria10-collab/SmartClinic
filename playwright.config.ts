import { defineConfig, devices } from "@playwright/test";

/**
 * Testes ponta a ponta (docs/12 §9). Pré-requisito: Supabase local rodando com o seed
 * (`npm run db:start` + `npm run db:reset`) — os e-mails são lidos do Mailpit local.
 * Os testes rodam em sequência porque compartilham o mesmo banco.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  // channel "chromium": usa o navegador completo em modo headless (dispensa baixar o "headless shell").
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium", viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
