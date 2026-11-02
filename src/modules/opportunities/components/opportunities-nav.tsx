"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ArrowLeft, Settings2 } from "lucide-react";
import { can, useSession } from "@/components/session-context";
import { cn } from "@/lib/cn";

/** Áreas do módulo. Fica dentro de Início (decisão O-1): o menu principal não ganha um 6º item. */
export function OpportunitiesNav() {
  const { org } = useParams<{ org: string }>();
  const pathname = usePathname();
  const session = useSession();
  const base = `/c/${org}/inicio/oportunidades`;
  const items = [
    { href: base, label: "Oportunidades", show: true },
    { href: `${base}/espera`, label: "Lista de espera", show: true },
    { href: `${base}/retornos`, label: "Retornos", show: true },
    { href: `${base}/orcamentos`, label: "Orçamentos", show: can(session, "proposals.read") || can(session, "proposals.read_own") },
  ].filter((i) => i.show);

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/c/${org}/inicio`} className="inline-flex h-9 items-center gap-1 rounded-sm pr-2 text-body-sm font-medium text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Início
        </Link>
        {can(session, "org.settings") && (
          <Link href={`/c/${org}/gestao/oportunidades`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-body-sm font-medium text-ink-2 hover:bg-white/70 hover:text-ink">
            <Settings2 className="size-4" aria-hidden /> Configurar
          </Link>
        )}
      </div>
      <nav aria-label="Áreas de Oportunidades" className="-mx-1 overflow-x-auto px-1">
        <ul className="glass inline-flex min-w-max gap-1 rounded-full border p-1">
          {items.map((i) => {
            const current = pathname === i.href;
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full px-3.5 text-body-sm font-medium transition-[background-color,color] duration-(--duration-fast)",
                    current ? "bg-white text-accent shadow-[0_2px_8px_rgb(6_47_94/0.14)]" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
