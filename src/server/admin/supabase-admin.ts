import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "../database.types";

/**
 * Cliente com a chave SECRETA: ignora a RLS. Uso restrito (docs/09 S2):
 * auditoria de eventos sem usuário (ex.: login com falha) e scripts administrativos.
 * Nunca use para ler ou alterar dados de clínicas em nome de um usuário.
 */
export function createSupabaseAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("Variável de ambiente ausente: SUPABASE_SECRET_KEY. Veja .env.example.");
  }
  return createClient<Database>(publicEnv.supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
