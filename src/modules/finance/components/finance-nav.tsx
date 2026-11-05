"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { can, useSession } from "@/components/session-context";
import { cn } from "@/lib/cn";

/** Áreas do Financeiro. Relatório e Categorias só para quem vê os totais (gestão). */
export function FinanceNav() {
  const { org } = useParams<{ org: string }>();
  const pathname = usePathname();
  const session = useSession();
  const base = `/c/${org}/financeiro`;
  const items = [
    { href: base, label: "Lançamentos", show: true },
    { href: `${base}/relatorio`, label: "Relatório", show: can(session, "finance.read") },
    { href: `${base}/categorias`, label: "Categorias", show: can(session, "finance.read") },
  ].filter((i) => i.show);
  if (items.length < 2) return null;
  return (
    <nav aria-label="Áreas do Financeiro" className="-mx-1 mb-5 overflow-x-auto px-1 print:hidden">
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
  );
}
