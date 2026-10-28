import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";

/** Usuários do supabase/seed.sql (somente banco local). */
export const SEED = {
  password: "Teste@12345",
  ana: "ana@clinica-aurora.test", // gestora
  bruno: "bruno@clinica-aurora.test", // recepção
};

/** E-mail único por execução: os testes não dependem de sobras de execuções anteriores. */
export const uniqueEmail = (prefix: string) => `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@e2e.test`;

export async function login(page: Page, email: string, password: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /^Conta:/ }).first().click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login\?saiu=1/);
}

/* ---------- E-mails capturados pelo Mailpit local ---------- */

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

interface MailpitSummary {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

/** Espera o e-mail mais recente para `to` (com assunto opcional) e devolve o primeiro link do HTML. */
export async function waitForEmailLink(to: string, subject?: RegExp): Promise<{ subject: string; link: string }> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: MailpitSummary[] };
    const msg = messages.find((m) => !subject || subject.test(m.Subject));
    if (msg) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { HTML: string };
      const link = /href="([^"]+)"/.exec(full.HTML)?.[1]?.replace(/&amp;/g, "&");
      if (link) return { subject: msg.Subject, link };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nenhum e-mail para ${to} chegou ao Mailpit`);
}

/* ---------- TOTP (RFC 6238), o mesmo cálculo dos aplicativos autenticadores ---------- */

function base32(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = secret.replace(/=+$/, "").toUpperCase().split("").map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0")).join("");
  return Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
}

export function totp(secret: string, step = Math.floor(Date.now() / 30_000)) {
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(step, 4);
  const h = createHmac("sha1", base32(secret)).update(counter).digest();
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, "0");
}

let lastStep = 0;
/** Código de uma janela de 30 s ainda não usada (o mesmo código não é aceito duas vezes). */
export async function freshTotp(secret: string) {
  let step = Math.floor(Date.now() / 30_000);
  while (step <= lastStep) {
    await new Promise((r) => setTimeout(r, 1000));
    step = Math.floor(Date.now() / 30_000);
  }
  lastStep = step;
  return totp(secret, step);
}

/** Cria conta, confirma o e-mail pelo link e conclui o onboarding. Devolve o slug criado. */
export async function signUpWithClinic(page: Page, opts: { name: string; email: string; password: string; clinic: string }) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome completo").fill(opts.name);
  await page.getByLabel("E-mail").fill(opts.email);
  await page.getByLabel("Senha", { exact: true }).fill(opts.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Confirme seu e-mail" })).toBeVisible();

  const { link } = await waitForEmailLink(opts.email, /Confirme seu e-mail/);
  await page.goto(link);
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel("Nome do estabelecimento").fill(opts.clinic);
  await expect(page.getByText(/Disponível: \/agendar\//)).toBeVisible();
  const slug = await page.getByLabel("Endereço da página de agendamento").inputValue();
  await page.getByRole("radio", { name: /Clínica de estética/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: /^2 a 5/ }).click();
  await page.getByRole("radio", { name: /Sim, eu atendo/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click(); // serviços sugeridos
  await page.getByRole("radio", { name: /Organizar a agenda/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Começar a usar" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${slug}/inicio`));
  return slug;
}
