"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { addDays, addMonths, addWeeks, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Inbox, Plus } from "lucide-react";
import { freeSlots } from "@/modules/availability/rules";
import { TimeGrid, type GridColumn } from "@/modules/scheduling/components/time-grid";
import { MonthView } from "@/modules/scheduling/components/month-view";
import { DayList } from "@/modules/scheduling/components/day-list";
import { AppointmentSheet, type SheetState } from "@/modules/scheduling/components/appointment-sheet";
import { select, useDb } from "@/prototype/store";
import type { Db } from "@/prototype/types";
import { Button } from "@/ui/button";
import { Select } from "@/ui/field";
import { Segmented } from "@/ui/primitives";
import { useMedia } from "@/lib/use-media";
import { cap, fmt } from "@/lib/format";

type View = "day" | "week" | "month";

export default function AgendaPage() {
  return (
    <Suspense>
      <Agenda />
    </Suspense>
  );
}

function Agenda() {
  const db = useDb();
  if (!db) return null;
  return <AgendaInner db={db} />;
}

function AgendaInner({ db }: { db: Db }) {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const mobile = useMedia("(max-width: 767px)");
  const ownId = db.viewer.role === "professional" ? db.viewer.professionalId : null;

  // ?novo=1 → abre o painel no próximo horário livre (ação rápida do Início).
  const [initialNew] = useState(() => (params.get("novo") === "1" ? nextFree(db, ownId ?? db.professionals[0].id) : null));
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(initialNew?.start ?? new Date()));
  // O filtro vale para o perfil que o escolheu; ao trocar de perfil, o profissional abre na própria agenda.
  const [filter, setFilter] = useState({ owner: ownId, value: ownId ?? "all" });
  const profFilter = filter.owner === ownId ? filter.value : (ownId ?? "all");
  const setProfFilter = (value: string) => setFilter({ owner: ownId, value });
  const [serviceFilter, setServiceFilter] = useState("all");
  const [showCancelled, setShowCancelled] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(initialNew ? { mode: "create", ...initialNew } : null);

  useEffect(() => {
    if (params.get("novo") === "1") router.replace(`/c/${org}/agenda`);
  }, [params, org, router]);

  const profIds = useMemo(() => (profFilter === "all" ? db.professionals.map((p) => p.id) : [profFilter]), [profFilter, db.professionals]);

  const appointments = useMemo(
    () =>
      db.appointments.filter(
        (a) =>
          profIds.includes(a.professionalId) &&
          // Sem acesso aos detalhes, o filtro de serviço não se aplica (senão revelaria o serviço).
          (serviceFilter === "all" || a.serviceId === serviceFilter || !select.canSeeDetails(db, a)) &&
          a.status !== "declined" &&
          a.status !== "expired" &&
          (showCancelled || a.status !== "cancelled"),
      ),
    [db, profIds, serviceFilter, showCancelled],
  );

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const columns: GridColumn[] =
    view === "day"
      ? profIds.map((pid) => {
          const p = select.professional(db, pid);
          return { key: pid, label: p.name, sublabel: p.specialty, day: anchor, lanes: [pid] };
        })
      : Array.from({ length: 7 }, (_, i) => {
          const d = addDays(weekStart, i);
          return { key: String(+d), label: fmt(d, "EEE d"), day: d, highlight: isSameDay(d, new Date()), lanes: profIds };
        }).filter((c) => c.day.getDay() !== 0 || profIds.some((pid) => db.availability.some((r) => r.professionalId === pid && r.weekday === 0)));

  const move = (dir: 1 | -1) =>
    setAnchor((d) => (view === "month" ? addMonths(d, dir) : view === "week" && !mobile ? addWeeks(d, dir) : addDays(d, dir)));

  const title =
    mobile || view === "day"
      ? cap(fmt(anchor, "EEEE, d 'de' MMMM"))
      : view === "week"
        ? `${fmt(weekStart, "d MMM")} – ${fmt(addDays(weekStart, 6), "d MMM yyyy")}`
        : cap(fmt(anchor, "MMMM 'de' yyyy"));

  const pending = select.pendingRequests(db).length;
  const openSlot = (professionalId: string, start: Date) => setSheet({ mode: "create", professionalId, start });
  const openAppt = (id: string) => setSheet({ mode: "view", id });

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-title-1 font-semibold">Agenda</h1>
          {pending > 0 && db.viewer.role !== "professional" && (
            <Link href={`/c/${org}/agenda/solicitacoes`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-warning-subtle px-3 text-body-sm font-medium text-warning hover:brightness-95">
              <Inbox className="size-4" aria-hidden /> {pending} solicitaç{pending > 1 ? "ões" : "ão"}
            </Link>
          )}
        </div>
        <Button className="hidden md:inline-flex" onClick={() => setSheet({ mode: "create", professionalId: profIds[0], start: nextRoundedSlot(anchor) })}>
          <Plus className="size-4" aria-hidden /> Novo agendamento
        </Button>
      </div>

      {/* Barra de ferramentas */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" onClick={() => move(-1)} aria-label="Período anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button variant="secondary" onClick={() => setAnchor(startOfDay(new Date()))}>
            Hoje
          </Button>
          <Button variant="secondary" size="icon" onClick={() => move(1)} aria-label="Próximo período">
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <p className="min-w-0 flex-1 truncate text-headline font-semibold" aria-live="polite">
          {title}
        </p>
        {!mobile && (
          <Segmented
            label="Visualização"
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: "Dia" },
              { value: "week", label: "Semana" },
              { value: "month", label: "Mês" },
            ]}
          />
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="f-prof">Profissional</label>
        <Select id="f-prof" value={profFilter} onChange={(e) => setProfFilter(e.target.value)} className="h-10 w-auto min-w-48 text-body-sm">
          <option value="all">Todos os profissionais</option>
          {db.professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === ownId ? `${p.name} (eu)` : p.name}
            </option>
          ))}
        </Select>
        <label className="sr-only" htmlFor="f-svc">Serviço</label>
        <Select id="f-svc" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="h-10 w-auto min-w-44 text-body-sm">
          <option value="all">Todos os serviços</option>
          {db.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-sm px-2 text-body-sm text-ink-2 hover:bg-muted">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          Mostrar cancelados
        </label>
        <Legend />
      </div>

      {mobile ? (
        <DayList db={db} day={anchor} professionalIds={profIds} appointments={appointments} onDay={setAnchor} onOpen={openAppt} onSlot={openSlot} />
      ) : view === "month" ? (
        <MonthView db={db} anchor={anchor} appointments={appointments} onPickDay={(d) => { setAnchor(d); setView("day"); }} />
      ) : (
        <TimeGrid db={db} columns={columns} appointments={appointments} onSlot={openSlot} onOpen={openAppt} />
      )}

      {/* Ação primária no celular */}
      <Button
        size="lg"
        className="fixed right-4 bottom-24 z-20 rounded-full shadow-lg md:hidden"
        onClick={() => setSheet({ mode: "create", professionalId: profIds[0], start: nextRoundedSlot(anchor) })}
      >
        <Plus className="size-5" aria-hidden /> Agendar
      </Button>

      <AppointmentSheet db={db} state={sheet} onClose={() => setSheet(null)} />
    </>
  );
}

function nextFree(db: Db, professionalId: string) {
  for (let d = 0; d < 14; d++) {
    const s = freeSlots({
      day: addDays(startOfDay(new Date()), d), professionalId, durationMin: 30, bufferAfterMin: 0, stepMin: 30,
      rules: db.availability, blocks: db.blocks, appointments: db.appointments, notBefore: new Date(),
    });
    if (s.length) return { professionalId, start: s[0] };
  }
  return null;
}

function nextRoundedSlot(day: Date) {
  const now = new Date();
  const base = isSameDay(day, now) ? now : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8);
  const d = new Date(base);
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0);
  return d;
}

function Legend() {
  return (
    <ul className="ml-auto hidden items-center gap-3 text-caption text-ink-2 xl:flex" aria-label="Legenda">
      <li className="flex items-center gap-1.5">
        <span className="stripes-pending size-3.5 rounded-xs border border-dashed border-warning bg-warning-subtle" aria-hidden /> Aguardando aprovação
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3.5 rounded-xs border-l-[3px] border-accent bg-accent-subtle" aria-hidden /> Confirmado
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3.5 rounded-xs border border-dashed border-danger" aria-hidden /> Faltou
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3.5 rounded-xs bg-[repeating-linear-gradient(135deg,var(--color-bg-subtle)_0_3px,var(--color-bg-muted)_3px_4px)] ring-1 ring-line" aria-hidden /> Fora do expediente
      </li>
    </ul>
  );
}
