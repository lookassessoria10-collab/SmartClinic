"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, BarChart3, ListOrdered, type LucideIcon } from "lucide-react";
import { can, useSession } from "@/components/session-context";
import type { Db } from "@/prototype/types";
import { Card, CardHeader } from "@/ui/primitives";
import { Summary } from "./entries-view";

/** Início de uma clínica sem Agenda (só Financeiro): resumo do mês e atalhos. */
export function FinanceHome({ db }: { db: Db }) {
  const { org } = useParams<{ org: string }>();
  const session = useSession();
  const base = `/c/${org}/financeiro`;
  const actions: { href: string; label: string; icon: LucideIcon; show: boolean }[] = [
    { href: `${base}?novo=receita`, label: "Nova receita", icon: ArrowUpCircle, show: can(session, "finance.write") },
    { href: `${base}?novo=despesa`, label: "Nova despesa", icon: ArrowDownCircle, show: can(session, "finance.read") },
    { href: `${base}/relatorio`, label: "Relatório do mês", icon: BarChart3, show: can(session, "finance.read") },
    { href: `${base}?status=atrasados`, label: "Contas em atraso", icon: ListOrdered, show: can(session, "finance.write") },
  ];
  return (
    <div className="flex flex-col gap-4">
      {db.financeMonth && <Summary report={db.financeMonth} />}
      <Card>
        <CardHeader title="Ações rápidas" description={db.financeMonth ? undefined : "Lance receitas e registre os recebimentos da clínica."} />
        <ul className="grid gap-2 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          {actions
            .filter((a) => a.show)
            .map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="flex h-14 items-center gap-3 rounded-md border border-line bg-surface px-4 font-medium hover:border-accent">
                  <a.icon className="size-5 text-accent" aria-hidden /> {a.label}
                </Link>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
