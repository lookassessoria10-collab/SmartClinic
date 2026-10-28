// Variáveis públicas (podem ir ao navegador). A chave secreta fica em src/server/admin.
// Referências literais a process.env.NEXT_PUBLIC_* são necessárias para o Next.js embuti-las.

function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}. Veja .env.example.`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
