import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/server/supabase";

// Links dos e-mails do Supabase Auth (supabase/templates/*.html): confirmação de cadastro,
// redefinição de senha e troca de e-mail. O token vale uma vez; depois disso, mensagem genérica.
const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), type === "recovery" ? "/redefinir-senha/nova" : "/onboarding");

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?erro=link", request.url));
}
