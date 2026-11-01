import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/server/supabase";

// Links dos e-mails do Supabase Auth: confirmação de cadastro, redefinição de senha, troca de
// e-mail, convite e link de acesso (magic link). Dois formatos:
//  • nossos modelos (supabase/templates/*.html): ?token_hash=…&type=… → verifyOtp aqui;
//  • modelos padrão do Supabase ({{ .ConfirmationURL }}): o Supabase confere o token e volta
//    com ?code=… (PKCE) → troca pela sessão. Assim o projeto funciona mesmo antes de os
//    modelos próprios serem colados no painel.
// O token vale uma vez; depois disso, mensagem genérica.
const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), type === "recovery" ? "/redefinir-senha/nova" : "/onboarding");

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    // Outro navegador (sem o verificador PKCE). Cadastro: o e-mail já foi confirmado pelo
    // Supabase, basta entrar. Nova senha: precisa abrir no mesmo navegador (ou usar nossos modelos).
    console.error("[auth] exchangeCodeForSession", error.code, error.message);
    if (next.startsWith("/redefinir-senha")) return NextResponse.redirect(new URL("/login?erro=navegador", request.url));
    if (!next.startsWith("/convite/")) return NextResponse.redirect(new URL("/login?confirmado=1", request.url));
  }
  // Link de convite vencido (vale 1 h): o convite vale 7 dias, e a página dele oferece um novo link.
  if (next.startsWith("/convite/")) return NextResponse.redirect(new URL(next, request.url));
  return NextResponse.redirect(new URL("/login?erro=link", request.url));
}
