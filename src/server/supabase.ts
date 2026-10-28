import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente Supabase com a sessão de quem fez a requisição: toda consulta passa pela RLS.
 * Criar um por requisição (as cookies são da requisição atual).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de um Server Component, que não pode gravar cookies. Sem problema:
          // o proxy.ts renova a sessão (e envia os cabeçalhos anti-cache) a cada requisição.
        }
      },
    },
  });
}
