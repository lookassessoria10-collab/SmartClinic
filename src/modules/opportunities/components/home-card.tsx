"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Db } from "@/prototype/types";
import { Card, CardHeader } from "@/ui/primitives";
import { money } from "@/lib/format";
import { KIND_META, describe } from "../labels";
import { namesFor } from "./opportunity-card";

/** Resumo no Início (decisão O-1): o módulo vive dentro de Início, sem item novo no menu. */
export function OpportunitiesHomeCard({ db }: { db: Db }) {
  const { org } = useParams<{ org: string }>();
  const snap = db.opportunities;
  if (!snap) return null;
  const s = snap.summary;
  const href = `/c/${org}/inicio/oportunidades`;
  const description = s.open
    ? [
        `${s.open} em aberto`,
        s.high ? `${s.high} de prioridade alta` : null,
        snap.values_visible && s.at_risk_cents ? `${money(s.at_risk_cents)} estimados em horários livres` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Nada pendente agora.";

  return (
    <Card>
      <CardHeader
        title="Oportunidades"
        description={description}
        icon={Sparkles}
        action={
          <Link href={href} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-body-sm font-medium text-accent hover:bg-accent-subtle">
            Ver todas <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />
      {snap.items.length > 0 && (
        <ul className="flex flex-col gap-1 px-3 pb-4">
          {snap.items.map((item) => {
            const Icon = KIND_META[item.kind].icon;
            const { title, context } = describe(item, namesFor(db, item));
            return (
              <li key={item.id}>
                <Link href={href} className="flex items-start gap-3 rounded-sm px-2 py-2 text-body-sm hover:bg-canvas">
                  <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{title}</span>
                    {context && <span className="block truncate text-caption text-ink-2">{context}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
