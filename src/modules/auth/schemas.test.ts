import { describe, expect, it } from "vitest";
import { fieldErrors, newPasswordSchema, signInSchema, signUpSchema } from "./schemas";
import { AUTH_MESSAGES, authErrorMessage } from "./messages";

describe("schemas de autenticação", () => {
  it("normaliza o e-mail", () => {
    const r = signInSchema.parse({ email: "  Ana@Clinica.TEST ", password: "x" });
    expect(r.email).toBe("ana@clinica.test");
  });

  it("exige senha de pelo menos 10 caracteres no cadastro (D-21)", () => {
    const r = signUpSchema.safeParse({ fullName: "Ana Ribeiro", email: "ana@exemplo.test", password: "curta123" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).password).toMatch(/10 caracteres/);
  });

  it("recusa senha acima de 72 bytes (limite do bcrypt)", () => {
    const r = signUpSchema.safeParse({ fullName: "Ana Ribeiro", email: "ana@exemplo.test", password: "á".repeat(40) });
    expect(r.success).toBe(false);
  });

  it("confere a confirmação da nova senha", () => {
    const r = newPasswordSchema.safeParse({ password: "SenhaBoa12345", confirm: "OutraSenha123" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).confirm).toBe("As senhas não coincidem.");
  });
});

describe("mensagens de erro", () => {
  it("usuário inexistente e senha errada recebem a mesma mensagem", () => {
    expect(authErrorMessage({ code: "user_not_found" })).toBe(AUTH_MESSAGES.invalidCredentials);
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe(AUTH_MESSAGES.invalidCredentials);
  });

  it("limite de requisições vira mensagem de espera", () => {
    expect(authErrorMessage({ status: 429 })).toBe(AUTH_MESSAGES.tooManyAttempts);
  });

  it("erro desconhecido não vaza detalhes", () => {
    expect(authErrorMessage({ code: "database_error_xyz" })).toBe(AUTH_MESSAGES.unexpected);
  });
});
