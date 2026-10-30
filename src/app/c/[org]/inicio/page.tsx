"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { addDays, endOfDay, isSameDay, startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";
import { useTransition } from "react";
import {
  ArrowRight, CalendarDays, CalendarPlus, Check, ClipboardList, Clock, Inbox, TrendingUp, UserPlus, UserX, Wallet,
} from "lucide-react";
import { select, useDb } from "@/modules/clinic/client";
import { setAppointmentStatus } from "@/modules/scheduling/actions";
import type { Appointment, Db } from "@/prototype/types";
import { Avatar, Card, CardHeader, EmptyState, PageHeader } from "@/ui/primitives";
import { StatusBadge } from "@/ui/status-badge";
import { Button } from "@/ui/button";
import { useToast } from "@/ui/toast";
import { cap, dayLabel, expiresIn, fmt, money, time } from "@/lib/format";
import { useSession } from "@/components/session-context";
import { cn } from "@/lib/cn";

export default function InicioPage() {
  const db = useDb();
  const session = useSession();
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  })();
  const first = session.user.name.replace(/^(Dra?\.)\s/, "").split(" ")[0];

  return (
    <>
      <PageHeader title={`${greeting}, ${first}`} description={cap(fmt(new Date(), "EEEE, d 'de' MMMM"))} />
      {session.role === "reception" && <ReceptionHome db={db} />}
      {session.role === "professional" && <ProfessionalHome db={db} />}
      {session.role === "manager" && <ManagerHome db={db} />}
    </>
  );
}

const visible = (a: Appointment) => !["declined", "expired", "cancelled"].includes(a.status);
const todays = (db: Db, professionalId?: string | null) =>
  db.appointments
    .filter((a) => isSameDay(new Date(a.startsAt), new Date()) && visible(a))
    .filter((a) => !professionalId || a.professionalId === professionalId)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

/* ---------- Recepção ---------- */

function ReceptionHome({ db }: { db: Db }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-4">
        <PendingCard db={db} />
        <TodayCard db={db} />
      </div>
      <div className="flex flex-col gap-4">
        <QuickActions />
        <NextUp db={db} />
      </div>
    </div>
  );
}

/* ---------- Profissional ---------- */

function ProfessionalHome({ db }: { db: Db }) {
  const pid = db.viewer.professionalId;
  if (!pid) {
    return (
      <Card>
        <EmptyState
          icon={CalendarDays}
          title="Sua agenda ainda não foi criada"
          description="Peça a quem gerencia a clínica para ligar sua conta a um profissional em Gestão → Profissionais."
        />
      </Card>
    );
  }
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i + 1));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <TodayCard db={db} professionalId={pid} title="Meus atendimentos de hoje" actionable />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Próximos dias" icon={CalendarDays} />
          <ul className="px-2 pb-3">
            {week.map((d) => {
              const n = db.appointments.filter((a) => a.professionalId === pid && isSameDay(new Date(a.startsAt), d) && ["confirmed", "requested"].includes(a.status)).length;
              return (
                <li key={+d} className="flex items-center justify-between rounded-sm px-3 py-2 text-body-sm">
                  {dayLabel(d)}
                  <span className={cn("tabular", n ? "font-medium" : "text-ink-3")}>{n ? `${n} atendimento${n > 1 ? "s" : ""}` : "Livre"}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <PendingCard db={db} compact />
      </div>
    </div>
  );
}

/* ---------- Gestora ---------- */

function ManagerHome({ db }: { db: Db }) {
  const now = new Date();
  const { org } = useParams<{ org: string }>();
  const week = db.appointments.filter((a) => new Date(a.startsAt) >= startOfWeek(now, { weekStartsOn: 1 }) && new Date(a.startsAt) < addDays(startOfWeek(now, { weekStartsOn: 1 }), 7));
  const active = select.activeProfessionals(db);
  const todo = [
    { done: active.length > 0, label: "Cadastrar profissionais", href: "gestao/profissionais" },
    { done: db.services.some((s) => s.active && s.professionalIds.length > 0), label: "Cadastrar serviços e quem atende cada um", href: "gestao/servicos" },
    { done: active.length > 0 && active.every((p) => db.availability.some((r) => r.professionalId === p.id)), label: "Configurar horários de atendimento", href: "gestao/horarios" },
    { done: db.services.some((s) => s.priceCents != null), label: "Informar preços dos serviços", href: "gestao/servicos" },
    { done: db.patients.length > 0, label: "Cadastrar o primeiro paciente", href: "pacientes?novo=1" },
  ];
  const last30 = db.appointments.filter((a) => new Date(a.startsAt) >= subDays(now, 30) && new Date(a.startsAt) < now);
  const noShows = last30.filter((a) => a.status === "no_show").length;
  const attended = last30.filter((a) => a.status === "completed").length;
  const today = todays(db).filter((a) => ["confirmed", "completed", "requested", "no_show"].includes(a.status));
  const month = db.appointments.filter((a) => new Date(a.startsAt) >= startOfMonth(now) && new Date(a.startsAt) <= endOfDay(now));
  const received = month.filter((a) => a.status === "completed").reduce((s, a) => s + (select.service(db, a.serviceId).priceCents ?? 0), 0);
  const toReceive = db.appointments
    .filter((a) => a.status === "confirmed" && new Date(a.startsAt) >= now && new Date(a.startsAt) < addDays(startOfMonth(now), 31))
    .reduce((s, a) => s + (select.service(db, a.serviceId).priceCents ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Atendimentos hoje" value={today.length} icon={CalendarDays} />
        <Stat label="Nesta semana" value={week.filter((a) => ["confirmed", "completed", "no_show"].includes(a.status)).length} icon={TrendingUp} />
        <Stat label="Faltas (30 dias)" value={`${attended + noShows ? Math.round((noShows / (attended + noShows)) * 100) : 0}%`} hint={`${noShows} de ${attended + noShows}`} icon={UserX} />
        <Stat label="Pacientes" value={db.patients.length} hint="cadastrados" icon={UserPlus} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <TodayCard db={db} title="Agenda de hoje" actionable />
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Financeiro do mês" description="Estimativa pelo preço dos serviços: concluídos e confirmados até o fim do mês." icon={Wallet} />
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-md border-t border-line bg-line">
              <div className="bg-surface p-4">
                <dt className="text-caption text-ink-2">Recebido</dt>
                <dd className="tabular mt-1 text-title-2 font-semibold text-success">{money(received)}</dd>
              </div>
              <div className="bg-surface p-4">
                <dt className="text-caption text-ink-2">A receber</dt>
                <dd className="tabular mt-1 text-title-2 font-semibold">{money(toReceive)}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Primeiros passos" icon={ClipboardList} />
            <ul className="flex flex-col gap-1 px-3 pb-4 text-body-sm">
              {todo.map((t) => (
                <Todo key={t.label} done={t.done} href={`/c/${org}/${t.href}`}>
                  {t.label}
                </Todo>
              ))}
            </ul>
          </Card>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

/* ---------- Blocos compartilhados ---------- */

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint?: string; icon: typeof Wallet }) {
  return (
    <Card as="div" className="p-4">
      <div className="flex items-center justify-between text-ink-2">
        <span className="text-body-sm">{label}</span>
        <Icon className="size-4" aria-hidden />
      </div>
      <p className="tabular mt-2 text-title-1 font-semibold">{value}</p>
      {hint && <p className="text-caption text-ink-3">{hint}</p>}
    </Card>
  );
}

function Todo({ children, done, href }: { children: React.ReactNode; done?: boolean; href: string }) {
  const body = (
    <>
      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", done ? "border-success bg-success text-white" : "border-line-strong")} aria-hidden>
        {done && <Check className="size-3" />}
      </span>
      <span className={cn(done && "text-ink-3 line-through")}>{children}</span>
      <span className="sr-only">{done ? "(concluído)" : "(pendente)"}</span>
    </>
  );
  return (
    <li>
      {done ? (
        <span className="flex items-center gap-2.5 rounded-sm px-2 py-1.5">{body}</span>
      ) : (
        <Link href={href} className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-muted">
          {body}
        </Link>
      )}
    </li>
  );
}

/** Solicitações da página pública (etapa C). Some enquanto não houver nenhuma. */
function PendingCard({ db, compact }: { db: Db; compact?: boolean }) {
  const { org } = useParams<{ org: string }>();
  const pending = select.pendingRequests(db);
  if (pending.length === 0) return null;
  const title = db.viewer.role === "professional" ? "Solicitações para mim" : "Solicitações pendentes";

  return (
    <Card>
      <CardHeader
        title={title}
        description={`${pending.length} aguardando aprovação`}
        icon={Inbox}
        action={
          <Link href={`/c/${org}/agenda/solicitacoes`} className="inline-flex h-9 items-center gap-1 rounded-sm px-2 text-body-sm font-medium text-accent hover:bg-accent-subtle">
            Ver todas <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />
      <ul className="divide-y divide-line border-t border-line">
        {pending.slice(0, compact ? 2 : 3).map((a) => (
          <li key={a.id} className="px-5 py-3.5">
            <p className="truncate font-medium">{select.personName(db, a)}</p>
            <p className="truncate text-body-sm text-ink-2">
              {select.service(db, a.serviceId).name} · {select.professional(db, a.professionalId).name} · {dayLabel(a.startsAt)} {time(a.startsAt)}
            </p>
            {a.holdExpiresAt && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-caption text-warning">
                <Clock className="size-3.5" aria-hidden /> Expira em {expiresIn(a.holdExpiresAt)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TodayCard({ db, professionalId, title = "Agenda de hoje", actionable }: { db: Db; professionalId?: string | null; title?: string; actionable?: boolean }) {
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [busy, start] = useTransition();
  const list = todays(db, professionalId);
  const now = new Date();
  const nextId = list.find((a) => new Date(a.endsAt) > now && ["confirmed", "requested"].includes(a.status))?.id;
  const mark = (id: string, to: "completed" | "no_show", ok: string) =>
    start(async () => {
      const r = await setAppointmentStatus(org, id, to);
      toast({ message: r.ok ? ok : (r.message ?? "Não foi possível alterar."), tone: r.ok ? "success" : "danger" });
    });

  return (
    <Card>
      <CardHeader
        title={title}
        description={`${list.length} na agenda`}
        icon={CalendarDays}
        action={
          <Link href={`/c/${org}/agenda`} className="inline-flex h-9 items-center gap-1 rounded-sm px-2 text-body-sm font-medium text-accent hover:bg-accent-subtle">
            Abrir agenda <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />
      {list.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhum atendimento hoje" description="Aproveite para organizar a semana." className="py-8" />
      ) : (
        <ol className="border-t border-line">
          {list.map((a) => {
            const prof = select.professional(db, a.professionalId);
            const isNext = a.id === nextId;
            const canSee = select.canSeeDetails(db, a);
            return (
              <li key={a.id} className={cn("flex items-center gap-3 border-b border-line px-5 py-3 last:border-0", isNext && "bg-accent-subtle")}>
                <span className="tabular w-12 shrink-0 text-body-sm font-semibold">{time(a.startsAt)}</span>
                <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: `var(--agenda-${prof.color})` }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {canSee ? select.personName(db, a) : "Horário ocupado"}
                    {isNext && <span className="ml-2 text-caption font-semibold text-accent">Próximo</span>}
                  </p>
                  <p className="truncate text-body-sm text-ink-2">
                    {canSee ? select.service(db, a.serviceId).name : prof.name}
                    {canSee && !professionalId && ` · ${prof.name}`}
                  </p>
                </div>
                {actionable && canSee && a.status === "confirmed" && new Date(a.startsAt) <= now ? (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => mark(a.id, "completed", "Marcado como concluído.")}>
                      Concluído
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => mark(a.id, "no_show", "Falta registrada.")}>
                      Faltou
                    </Button>
                  </div>
                ) : (
                  <StatusBadge status={a.status} className="hidden sm:inline-flex" />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function NextUp({ db }: { db: Db }) {
  const now = new Date();
  const upcoming = db.appointments
    .filter((a) => a.status === "confirmed" && !a.hidden && new Date(a.startsAt) > now)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 4);
  return (
    <Card>
      <CardHeader title="Próximos pacientes" icon={Clock} />
      {upcoming.length === 0 ? (
        <p className="px-5 pb-5 text-body-sm text-ink-3">Nenhum agendamento futuro.</p>
      ) : (
        <ul className="px-3 pb-3">
          {upcoming.map((a) => {
            const prof = select.professional(db, a.professionalId);
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-sm px-2 py-2">
                <Avatar name={select.personName(db, a)} color={prof.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium">{select.personName(db, a)}</p>
                  <p className="truncate text-caption text-ink-2">
                    {dayLabel(a.startsAt)}, {time(a.startsAt)} · {prof.name}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function QuickActions() {
  const { org } = useParams<{ org: string }>();
  const item = "flex h-12 items-center gap-3 rounded-sm px-3 text-body-sm font-medium hover:bg-muted";
  return (
    <Card>
      <CardHeader title="Ações rápidas" />
      <div className="flex flex-col px-2 pb-3">
        <Link href={`/c/${org}/agenda?novo=1`} className={item}>
          <CalendarPlus className="size-5 text-accent" aria-hidden /> Novo agendamento
        </Link>
        <Link href={`/c/${org}/pacientes?novo=1`} className={item}>
          <UserPlus className="size-5 text-accent" aria-hidden /> Novo paciente
        </Link>
      </div>
    </Card>
  );
}
