import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LAST_CLINIC_COOKIE } from "@/modules/auth/constants";

/**
 * Proxy (Next 16; antigo middleware). Duas tarefas apenas (docs/12 §3.1):
 *  1. Renovar a sessão do Supabase nas cookies a cada requisição.
 *  2. Mandar quem não está logado das áreas protegidas para o /login.
 * A autorização de verdade (clínica, papel, permissão) acontece no servidor e na RLS.
 */
const PROTECTED = [/^\/c(\/|$)/, /^\/onboarding(\/|$)/, /^\/redefinir-senha\/nova(\/|$)/];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          // Para os Server Components desta requisição...
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // ...e para o navegador, sem cache (a sessão de um não pode ir para outro).
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // getClaims valida a assinatura do token e o renova quando necessário. Não remover.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (!signedIn && PROTECTED.some((re) => re.test(pathname))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    // Mantém cookies de sessão limpas/renovadas também no redirecionamento.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  // Lembra a última clínica aberta para o pós-login (só o slug; o acesso é checado no layout).
  const clinic = signedIn ? /^\/c\/([a-z0-9-]{3,48})(\/|$)/.exec(pathname)?.[1] : undefined;
  if (clinic && request.cookies.get(LAST_CLINIC_COOKIE)?.value !== clinic) {
    response.cookies.set(LAST_CLINIC_COOKIE, clinic, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }

  return response;
}

export const config = {
  // Tudo menos arquivos estáticos e imagens.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
