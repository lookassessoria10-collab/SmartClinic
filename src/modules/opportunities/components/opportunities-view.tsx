"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Inbox, RefreshCw, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import { select, useDb } from "@/modules/clinic/client";
import { can, useSession } from "@/components/session-context";
import type { OpportunityItem, OpportunitySnapshot } from "@/prototype/types";
import { Button } from "@/ui/button";
import { Select } from "@/ui/field";
import { Card, EmptyState, PageHeader } from "@/ui/primitives";
import { useToast } from "@/ui/toast";
import { money, time } from "@/lib/format";
import { cn } from "@/lib/cn";
import { refreshOpportunities } from "../actions";
import { MAX_PAGES, PAGE_SIZE, PERIODS, SORTS, TABS, filtersQuery, type Filters, type Tab } from "../filters";
import { OpportunitiesNav } from "./opportunities-nav";
import { OpportunityCard, primaryLink } from "./opportunity-card";
import { OpportunitySheet, type TeamMember } from "./opportunity-sheet";

export function OpportunitiesView({
  snapshot, error, filters, team,
}: {
  snapshot: OpportunitySnapshot | null;
  error: string | null;
  filters: Filters;
  team: TeamMember[];
}) {
  const db = useDb();
  const session = useSession();
  const router = useRouter();
  const toast = useToast();
  const { org } = useParams<{ org: string }>();
  const base = `/c/${org}/inicio/oportunidades`;
  const [refreshing, startRefresh] = useTransition();
  const [selected, setSelected] = useState<{ item: OpportunityItem; mode: "view" | "contact" } | null>(null);

  const go = (patch: Partial<Filters>) => router.push(`${base}${filtersQuery(filters, { page: 1, ...patch })}`, { scroll: false });
  const workAll = can(session, "opportunities.work");
  const canWork = (i: OpportunityItem) => workAll || (can(session, "opportunities.work_own") && !!i.professional_id && i.professional_id === db.viewer.professionalId);
  const teamNames = Object.fromEntries(team.map((m) => [m.userId, m.name]));
  // O painel acompanha os dados novos depois de cada ação (revalidação do servidor). Resolvida ou
  // descartada sai da lista da aba e o painel fecha: não sobram ações que já não valem.
  const current = selected ? (snapshot?.items.find((i) => i.id === selected.item.id) ?? null) : null;

  return (
    <>
      <OpportunitiesNav />
      <PageHeader
        title="Oportunidades"
        description="Identifique pendências e aproveite melhor a agenda da sua clínica."
        actions={
          <Button
            variant="secondary"
            loading={refreshing}
            onClick={() =>
              startRefresh(async () => {
                const r = await refreshOpportunities(org);
                if (!r.ok) toast({ message: r.message ?? "Não foi possível atualizar.", tone: "danger" });
              })
            }
          >
            {!refreshing && <RefreshCw className="size-4" aria-hidden />} Atualizar
          </Button>
        }
      />

      {error || !snapshot ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar as oportunidades"
            description={error ?? "Tente de novo em instantes."}
            action={<Button onClick={() => router.refresh()}>Tentar de novo</Button>}
          />
        </Card>
      ) : (
        <>
          <Indicators snapshot={snapshot} days={Number(filters.period)} />

          <div className="mt-5 mb-3 flex flex-wrap items-end gap-2" role="group" aria-label="Filtros">
            <label className="flex flex-col gap-1 text-caption text-ink-2">
              Período
              <Select value={filters.period} onChange={(e) => go({ period: e.target.value as Filters["period"] })} className="h-10 min-w-44 text-body-sm">
                {Object.entries(PERIODS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </label>
            {db.viewer.role !== "professional" && select.activeProfessionals(db).length > 1 && (
              <label className="flex flex-col gap-1 text-caption text-ink-2">
                Profissional
                <Select value={filters.professional} onChange={(e) => go({ professional: e.target.value })} className="h-10 min-w-48 text-body-sm">
                  <option value="">Todos</option>
                  {select.activeProfessionals(db).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-caption text-ink-2">
              Ordenar por
              <Select value={filters.sort} onChange={(e) => go({ sort: e.target.value as Filters["sort"] })} className="h-10 min-w-40 text-body-sm">
                {Object.entries(SORTS).map(([v, l]) => (
                  <option key={v} value={v} disabled={v === "valor" && !snapshot.values_visible}>
                    {l}
                  </option>
                ))}
              </Select>
            </label>
            {snapshot.refreshed_at && <p className="ml-auto pb-2 text-caption text-ink-3">Atualizado às {time(snapshot.refreshed_at)}</p>}
          </div>

          <CategoryTabs base={base} filters={filters} snapshot={snapshot} />

          {snapshot.items.length === 0 ? (
            <Card>
              <Empty tab={filters.tab} org={org} />
            </Card>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {snapshot.items.map((item) => (
                  <OpportunityCard
                    key={item.id}
                    db={db}
                    org={org}
                    item={item}
                    assignee={item.assigned_to ? teamNames[item.assigned_to] : undefined}
                    canWork={canWork(item)}
                    onOpen={(mode) => setSelected({ item, mode })}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-caption text-ink-2">
                <span>
                  Mostrando {snapshot.items.length} de {snapshot.total}
                </span>
                {snapshot.items.length < snapshot.total && filters.page < MAX_PAGES && (
                  <Link href={`${base}${filtersQuery(filters, { page: filters.page + 1 })}`} scroll={false} className="font-medium text-accent hover:underline">
                    Mostrar mais {Math.min(PAGE_SIZE, snapshot.total - snapshot.items.length)}
                  </Link>
                )}
              </div>
            </>
          )}
        </>
      )}

      <OpportunitySheet
        db={db}
        org={org}
        item={current}
        mode={selected?.mode ?? "view"}
        team={team}
        canWork={current ? canWork(current) : false}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function Indicator({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: LucideIcon }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-caption font-medium text-ink-2">{label}</p>
        <Icon className="size-4 text-ink-3" aria-hidden />
      </div>
      <p className="tabular mt-1 text-title-2 font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-caption text-ink-2">{hint}</p>}
    </Card>
  );
}

function Indicators({ snapshot, days }: { snapshot: OpportunitySnapshot; days: number }) {
  const s = snapshot.summary;
  const riskHint = !snapshot.values_visible
    ? "Valores visíveis para a gestão"
    : [
        s.at_risk_unpriced ? `${s.at_risk_unpriced} sem preço cadastrado` : "Estimativa pelo preço dos serviços",
        s.proposals_cents ? `+ ${money(s.proposals_cents)} em orçamentos parados (à parte)` : null,
      ]
        .filter(Boolean)
        .join(" · ");
  const horizon = Math.min(days, snapshot.horizon_days);
  return (
    <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Indicator
        label="Receita potencial em risco"
        value={snapshot.values_visible ? (s.at_risk_cents != null ? money(s.at_risk_cents) : s.at_risk_unpriced ? "Indisponível" : money(0)) : "Restrito"}
        hint={riskHint}
        icon={Wallet}
      />
      <Indicator label="Horários disponíveis" value={String(s.free_slots)} hint={`Próximos ${horizon} dias`} icon={CalendarClock} />
      <Indicator label="Oportunidades em aberto" value={String(s.open)} hint={s.high ? `${s.high} de prioridade alta` : "Nenhuma urgente"} icon={Inbox} />
      <Indicator label="Oportunidades resolvidas" value={String(s.resolved)} hint={`Últimos ${days} dias`} icon={CheckCircle2} />
    </section>
  );
}

function CategoryTabs({ base, filters, snapshot }: { base: string; filters: Filters; snapshot: OpportunitySnapshot }) {
  const s = snapshot.summary;
  const counts: Partial<Record<Tab, number>> = { todas: s.open, agenda: s.agenda, pacientes: s.pacientes, financeiro: s.financeiro };
  return (
    <nav aria-label="Categorias" className="-mx-1 mb-4 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-2">
        {(Object.entries(TABS) as [Tab, string][]).map(([tab, label]) => {
          const current = filters.tab === tab;
          return (
            <li key={tab}>
              <Link
                href={`${base}${filtersQuery(filters, { tab, page: 1 })}`}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-body-sm font-medium",
                  current ? "border-accent bg-accent-subtle text-accent" : "border-line-strong text-ink-2 hover:text-ink",
                )}
              >
                {label}
                {counts[tab] != null && <span className="tabular text-caption">{counts[tab]}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Empty({ tab, org }: { tab: Tab; org: string }) {
  const db = useDb();
  const noSchedule = select.activeProfessionals(db).length === 0 || db.availability.length === 0;
  const link = (href: string, text: string) => (
    <Link href={href} className={primaryLink}>
      {text}
    </Link>
  );
  switch (tab) {
    case "agenda":
      return noSchedule ? (
        <EmptyState icon={CalendarClock} title="Sem horários de atendimento" description="Cadastre profissionais, serviços e horários de atendimento para ver os horários livres aqui." action={link(`/c/${org}/gestao/horarios`, "Configurar horários")} />
      ) : (
        <EmptyState icon={CalendarClock} title="Nenhum horário livre no período" description="A agenda está ocupada ou bloqueada. Horários liberados por cancelamento aparecem aqui assim que acontecerem." />
      );
    case "pacientes":
      return (
        <EmptyState icon={Sparkles} title="Nenhum paciente para acompanhar" description="Retornos registrados, faltas e cancelamentos sem remarcação aparecem aqui." action={link(`/c/${org}/inicio/oportunidades/retornos?novo=1`, "Registrar retorno")} />
      );
    case "financeiro":
      return (
        <EmptyState icon={Wallet} title="Nenhum orçamento parado" description="Orçamentos em aberto sem atualização há alguns dias aparecem aqui para você acompanhar." action={link(`/c/${org}/inicio/oportunidades/orcamentos?novo=1`, "Novo orçamento")} />
      );
    case "resolvidas":
      return <EmptyState icon={CheckCircle2} title="Nada resolvido no período" description="Oportunidades resolvidas, descartadas ou expiradas ficam aqui, com o histórico." />;
    default:
      return noSchedule ? (
        <EmptyState icon={Sparkles} title="Comece pela agenda" description="Com profissionais, serviços e horários cadastrados, o sistema passa a mostrar horários livres, retornos e orçamentos parados." action={link(`/c/${org}/gestao/horarios`, "Configurar horários")} />
      ) : (
        <EmptyState icon={Sparkles} title="Nada pendente por aqui" description="A agenda do período está cheia e não há retornos ou orçamentos parados. Registre retornos e orçamentos para acompanhá-los aqui." action={link(`/c/${org}/inicio/oportunidades/retornos?novo=1`, "Registrar retorno")} />
      );
  }
}
