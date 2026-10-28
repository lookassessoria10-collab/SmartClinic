import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

export function BackToGestao({ slug }: { slug: string }) {
  return (
    <Link href={`/c/${slug}/gestao`} className="mb-3 inline-flex h-9 items-center gap-1 rounded-sm pr-2 text-body-sm font-medium text-ink-2 hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Gestão
    </Link>
  );
}

/** Mesma mensagem da casca; aqui vem do servidor (a permissão é conferida antes de buscar dados). */
export function NoPermission() {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-muted text-ink-3">
        <Lock className="size-6" aria-hidden />
      </span>
      <p className="text-headline font-semibold">Você não tem acesso a esta área</p>
      <p className="mt-1 max-w-sm text-body-sm text-ink-2">Fale com o gestor da clínica se precisar desta permissão.</p>
    </div>
  );
}
