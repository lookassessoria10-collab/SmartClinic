"use client";

import Link from "next/link";
import { CalendarPlus, ChevronRight, MessageSquare, UserRound } from "lucide-react";
import { select } from "@/modules/clinic/client";
import type { Db, OpportunityItem } from "@/prototype/types";
import { Button } from "@/ui/button";
import { cn } from "@/lib/cn";
import { bookingHref, opportunityBooking } from "../booking";
import { KIND_META, PRIORITY_META, STATUS_LABEL, describe, valueLabel } from "../labels";

export const primaryLink =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-body-sm font-medium whitespace-nowrap glass-tint hover:brightness-[1.06]";
export const secondaryLink =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-body-sm font-medium whitespace-nowrap glass text-ink hover:bg-white/80";

export function namesFor(db: Db, item: OpportunityItem) {
  return {
    professional: item.professional_id ? select.professional(db, item.professional_id).name : undefined,
    patient: select.patient(db, item.patient_id)?.name,
    service: item.service_id ? db.services.find((s) => s.id === item.service_id)?.name : undefined,
  };
}

export function PriorityBadge({ priority }: { priority: 1 | 2 | 3 }) {
  const meta = PRIORITY_META[priority];
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-caption font-medium", meta.className)}>{meta.label}</span>;
}

export function OpportunityCard({
  db, org, item, assignee, canWork, onOpen,
}: {
  db: Db;
  org: string;
  item: OpportunityItem;
  assignee?: string;
  canWork: boolean;
  onOpen: (mode: "view" | "contact") => void;
}) {
  const meta = KIND_META[item.kind];
  const { title, context } = describe(item, namesFor(db, item));
  const value = valueLabel(item);
  const open = item.status === "new" || item.status === "in_progress";
  const booking = open && canWork ? opportunityBooking(db, item) : null;
  const titleId = `op-${item.id}`;
  // Agenda: agendar é a ação principal. Pacientes e orçamentos: registrar o contato (feito à mão).
  const contactFirst = item.kind === "proposal_stale" || item.kind === "no_show" || item.kind === "cancelled_appointment";

  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-3 rounded-lg border border-white/80 bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-accent-subtle text-accent">
          <meta.icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-medium text-ink-2">{meta.label}</p>
          <h3 id={titleId} className="font-semibold">
            {title}
          </h3>
          {context && <p className="text-body-sm text-ink-2">{context}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-caption">
        {open && <PriorityBadge priority={item.priority} />}
        {item.status !== "new" && (
          <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 font-medium text-ink-2">{STATUS_LABEL[item.status]}</span>
        )}
        {assignee && (
          <span className="inline-flex h-6 items-center gap-1 text-ink-2">
            <UserRound className="size-3.5" aria-hidden /> {assignee}
          </span>
        )}
        {value && <span className="tabular ml-auto font-semibold text-ink">{value}</span>}
      </div>
      {item.status === "dismissed" && item.dismiss_reason && <p className="text-caption text-ink-2">Motivo: {item.dismiss_reason}</p>}

      <div className="mt-auto flex flex-wrap gap-2">
        {open && canWork && contactFirst && (
          <Button size="sm" onClick={() => onOpen("contact")}>
            <MessageSquare className="size-4" aria-hidden /> Registrar contato
          </Button>
        )}
        {booking && (
          <Link href={bookingHref(org, booking)} className={contactFirst ? secondaryLink : primaryLink}>
            <CalendarPlus className="size-4" aria-hidden /> Agendar
          </Link>
        )}
        <Button size="sm" variant="ghost" onClick={() => onOpen("view")} aria-describedby={titleId}>
          {item.kind === "cancelled_slot" && item.matches ? `Ver sugestões (${item.matches})` : "Detalhes"}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </article>
  );
}
