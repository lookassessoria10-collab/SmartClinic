import Link from "next/link";
import { SearchX } from "lucide-react";

// Mesma resposta para página inexistente e para clínica de que a pessoa não faz parte
// (requireMember usa notFound): não revela quais clínicas existem.
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="mb-4 grid size-14 place-items-center rounded-full bg-muted text-ink-3">
          <SearchX className="size-6" aria-hidden />
        </span>
        <h1 className="text-title-1 font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-body-sm text-ink-2">O endereço pode estar errado, ou você não tem acesso a esta clínica.</p>
        <Link href="/login" className="mt-6 inline-flex h-10 items-center rounded-sm bg-accent px-4 text-body-sm font-medium text-on-accent hover:bg-accent-hover">
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
