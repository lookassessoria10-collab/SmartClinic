import "server-only";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Endereço do site para os links dos e-mails (confirmação, senha, convite): o domínio por
 * onde a pessoa está acessando. Não depende de NEXT_PUBLIC_SITE_URL estar certa na
 * hospedagem e funciona igual em produção, prévias e localhost. Seguro porque o Supabase
 * Auth só aceita destinos que estão na lista "Redirect URLs" do projeto.
 */
export async function siteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
  if (!host) return publicEnv.siteUrl;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
  return `${proto}://${host}`;
}
