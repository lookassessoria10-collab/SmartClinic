import type { CookieOptions } from "@supabase/ssr";

/**
 * Endurece as cookies de sessão do Supabase (docs/09 §3, revisão da Fase 3).
 *
 * - HttpOnly: o JavaScript da página não lê o token — um XSS não rouba a sessão. Possível
 *   porque o app nunca usa o Supabase no navegador; tudo passa pelo servidor.
 * - Secure: em produção, só por HTTPS.
 * - SameSite=Lax: não vai em requisições de outros sites (CSRF), mas funciona nos links de e-mail.
 *
 * Usado pelo cliente do servidor e pelo proxy, para os dois gravarem a cookie igual.
 */
export function hardenSessionCookie(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: options.path ?? "/",
  };
}
