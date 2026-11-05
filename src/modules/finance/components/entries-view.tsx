"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Check, Download, MoreHorizontal, Plus, Receipt, Scale, Wallet, type LucideIcon } from "lucide-react";
import { select, useDb } from "@/modules/clinic/client";
import { can, useSession } from "@/components/session-context";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Field, Input, Select } from "@/ui/field";
import { Card, EmptyState, PageHeader } from "@/ui/primitives";
import { Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";
import { fmt, money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { changeEntryStatus, payEntry } from "../actions";
import {
  METHOD_LABEL, PERIODS, SITUATION_META, STATUSES, TYPES, entryFiltersQuery, seriesLabel, situation,
  type Category, type Entry, type EntryFilters, type FinType, type FinanceReport, type PaymentMethod,
} from "../model";
import { EntryForm } from "./entry-form";
import { FinanceNav } from "./finance-nav";

const day = (iso: string) => fmt(`${iso}T12:00`, "dd/MM/yyyy");

export function EntriesView({
  entries, categories, filters, report, truncated, openNew,
}: {
  entries: Entry[];
  categories: Category[];
  filters: EntryFilters;
  report: FinanceReport | null;
  truncated: boolean;
  openNew: FinType | null;
}) {
  const db = useDb();
  const session = useSession();
  const router = useRouter();
  const toast = useToast();
  const { org } = useParams<{ org: string }>();
  const base = `/c/${org}/financeiro`;
  const canRead = can(session, "finance.read");
  const canWrite = can(session, "finance.write");
  const today = format(new Date(), "yyyy-MM-dd");
  const [editing, setEditing] = useState<{ entry?: Entry; type: FinType } | null>(() => (openNew && canWrite ? { type: canRead ? openNew : "income" } : null));
  const [paying, setPaying] = useState<Entry | null>(null);
  const [cancelling, setCancelling] = useState<Entry | null>(null);
  const [following, setFollowing] = useState(false);
  const [busy, start] = useTransition();
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  // Limpa ?novo= depois de abrir o formulário (atalhos do Início).
  useEffect(() => {
    if (openNew) router.replace(`${base}${entryFiltersQuery(filters)}`);
  }, [openNew, router, base, filters]);

  const undo = (e: Entry) =>
    start(async () => {
      const r = await changeEntryStatus(org, e.id, "pending");
      toast({ message: r.ok ? "Voltou para pendente." : (r.message ?? "Não foi possível alterar."), tone: r.ok ? "info" : "danger" });
    });

  return (
    <>
      <FinanceNav />
      <PageHeader
        title="Financeiro"
        description={canRead ? "Receitas, despesas e o que está para receber e pagar." : "Receitas da clínica: lance e registre os recebimentos."}
        actions={
          canWrite && (
            <>
              {canRead && (
                <Link href={`${base}/exportar${entryFiltersQuery(filters)}`} prefetch={false} className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-body-sm font-medium glass hover:bg-white/80">
                  <Download className="size-4" aria-hidden /> Exportar CSV
                </Link>
              )}
              {canRead && (
                <Button variant="secondary" onClick={() => setEditing({ type: "expense" })}>
                  <ArrowDownCircle className="size-4" aria-hidden /> Nova despesa
                </Button>
              )}
              <Button onClick={() => setEditing({ type: "income" })}>
                <Plus className="size-4" aria-hidden /> Nova receita
              </Button>
            </>
          )
        }
      />

      {report && <Summary report={report} />}

      <Filters base={base} filters={filters} categories={categories} canRead={canRead} />

      <Card className="overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum lançamento neste filtro"
            description={canWrite ? "Lance uma receita ou despesa, ou mude o período e a situação." : "Mude o período ou a situação."}
          />
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((e) => {
              const sit = situation(e, today);
              const meta = SITUATION_META[sit];
              const patient = select.patient(db, e.patientId);
              const series = seriesLabel(e);
              const editable = canWrite && (e.type === "income" || canRead);
              return (
                <li key={e.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", e.type === "income" ? "bg-accent-subtle text-accent" : "bg-warning-subtle text-warning")}
                      aria-hidden
                    >
                      {e.type === "income" ? <ArrowUpCircle className="size-5" /> : <ArrowDownCircle className="size-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="sr-only">{e.type === "income" ? "Receita: " : "Despesa: "}</span>
                        {e.description}
                      </p>
                      <p className="text-caption text-ink-2">
                        {[catName(e.categoryId), series, patient?.name, e.professionalId ? select.professional(db, e.professionalId).name : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="tabular text-caption text-ink-2">
                        {e.status === "paid" && e.paidAt
                          ? `${e.type === "income" ? "Recebido" : "Pago"} em ${day(e.paidAt)}${e.method ? ` · ${METHOD_LABEL[e.method]}` : ""}`
                          : `Vence em ${day(e.dueDate)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-caption font-medium", meta.className)}>
                      {sit === "overdue" && <AlertTriangle className="mr-1 size-3.5" aria-hidden />}
                      {meta.label}
                    </span>
                    <span className={cn("tabular w-32 text-right font-semibold", e.status === "cancelled" && "text-ink-3 line-through")}>
                      {e.type === "income" ? "+ " : "− "}
                      {money(e.amountCents)}
                    </span>
                    {editable && e.status === "pending" && (
                      <Button size="sm" variant="secondary" onClick={() => setPaying(e)} aria-label={`${e.type === "income" ? "Receber" : "Pagar"}: ${e.description}`}>
                        <Check className="size-4" aria-hidden /> {e.type === "income" ? "Receber" : "Pagar"}
                      </Button>
                    )}
                    {editable && e.status !== "cancelled" && (
                      <Menu.Root>
                        <Menu.Trigger className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-white/70" aria-label={`Mais ações: ${e.description}`}>
                          <MoreHorizontal className="size-5" aria-hidden />
                        </Menu.Trigger>
                        <Menu.Portal>
                          <Menu.Content align="end" sideOffset={6} className="glass-strong z-50 min-w-48 rounded-[18px] border p-1.5">
                            <MenuItem onSelect={() => setEditing({ entry: e, type: e.type })}>Editar</MenuItem>
                            {e.status === "paid" && <MenuItem onSelect={() => undo(e)}>Voltar para pendente</MenuItem>}
                            <MenuItem
                              danger
                              onSelect={() => {
                                setFollowing(false);
                                setCancelling(e);
                              }}
                            >
                              Cancelar lançamento
                            </MenuItem>
                          </Menu.Content>
                        </Menu.Portal>
                      </Menu.Root>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {truncated && <p className="mt-3 text-caption text-ink-2">Mostrando os 500 mais recentes. Use os filtros para ver os demais.</p>}

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.entry ? "Editar lançamento" : editing?.type === "expense" ? "Nova despesa" : "Nova receita"}
        description={editing?.entry ? seriesLabel(editing.entry) ?? undefined : "Valores em reais. Sem informação clínica."}
      >
        {editing && (
          <EntryForm
            key={editing.entry?.id ?? editing.type}
            categories={categories}
            entry={editing.entry}
            initialType={editing.type}
            canExpense={canRead}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>

      <Sheet open={paying !== null} onOpenChange={(o) => !o && setPaying(null)} title={paying?.type === "income" ? "Registrar recebimento" : "Registrar pagamento"} description={paying ? `${paying.description} · ${money(paying.amountCents)}` : undefined}>
        {paying && <PayForm key={paying.id} entry={paying} onDone={() => setPaying(null)} />}
      </Sheet>

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(o) => !o && setCancelling(null)}
        destructive
        title="Cancelar lançamento?"
        description={`${cancelling?.description ?? ""} · ${money(cancelling?.amountCents)}. O lançamento fica no histórico como cancelado e sai dos totais.`}
        confirmLabel="Cancelar lançamento"
        onConfirm={() =>
          start(async () => {
            if (!cancelling) return;
            const r = await changeEntryStatus(org, cancelling.id, "cancelled", following);
            toast({
              message: r.ok ? (r.data && r.data.count > 1 ? `${r.data.count} lançamentos cancelados.` : "Lançamento cancelado.") : (r.message ?? "Não foi possível cancelar."),
              tone: r.ok ? "success" : "danger",
            });
            setCancelling(null);
          })
        }
      >
        {cancelling?.seriesId && (
          <label className="flex items-center gap-3 text-body-sm">
            <input type="checkbox" checked={following} onChange={(ev) => setFollowing(ev.target.checked)} className="size-4 accent-[var(--color-accent)]" />
            Cancelar também os próximos pendentes desta série
          </label>
        )}
      </ConfirmDialog>
      {busy && <span className="sr-only" role="status">Salvando…</span>}
    </>
  );
}

function MenuItem({ children, onSelect, danger }: { children: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn("flex h-10 cursor-default items-center rounded-[14px] px-2.5 text-body-sm outline-none data-[highlighted]:bg-accent-subtle", danger && "text-danger")}
    >
      {children}
    </Menu.Item>
  );
}

function PayForm({ entry, onDone }: { entry: Entry; onDone: () => void }) {
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [paidAt, setPaidAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [method, setMethod] = useState<PaymentMethod | "">("pix");
  const [error, setError] = useState<string>();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await payEntry(org, { id: entry.id, paidAt, method });
          if (!r.ok) return setError(r.message);
          toast({ message: entry.type === "income" ? "Recebimento registrado." : "Pagamento registrado.", tone: "success" });
          onDone();
        });
      }}
    >
      {error && <p role="alert" className="text-body-sm text-danger">{error}</p>}
      <Field label={entry.type === "income" ? "Data do recebimento" : "Data do pagamento"}>
        <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} autoFocus />
      </Field>
      <Field label="Forma de pagamento" optional>
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | "")}>
          <option value="">Não informar</option>
          {(Object.entries(METHOD_LABEL) as [PaymentMethod, string][]).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        Confirmar
      </Button>
    </form>
  );
}

function Tile({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: LucideIcon }) {
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

/** Totais do período (gestão). Realizado pela data do pagamento; previsto pelo vencimento. */
export function Summary({ report }: { report: FinanceReport }) {
  const result = report.realized.income - report.realized.expense;
  const overdue = report.overdue.income_count + report.overdue.expense_count;
  return (
    <section aria-label="Resumo do período" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Receitas recebidas" value={money(report.realized.income)} hint={`A receber no período: ${money(report.forecast.income)}`} icon={ArrowUpCircle} />
      <Tile label="Despesas pagas" value={money(report.realized.expense)} hint={`A pagar no período: ${money(report.forecast.expense)}`} icon={ArrowDownCircle} />
      <Tile label="Resultado" value={`${result < 0 ? "− " : ""}${money(Math.abs(result))}`} hint="Recebido menos pago" icon={Scale} />
      <Tile
        label="Em atraso"
        value={String(overdue)}
        hint={overdue ? `${money(report.overdue.income)} a receber · ${money(report.overdue.expense)} a pagar` : "Nada vencido"}
        icon={Receipt}
      />
    </section>
  );
}

function Filters({ base, filters, categories, canRead }: { base: string; filters: EntryFilters; categories: Category[]; canRead: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(filters);
  const set = (patch: Partial<EntryFilters>) => setF((x) => ({ ...x, ...patch }));
  const visibleCats = categories.filter((c) => canRead || c.type === "income");
  return (
    <form
      className="mb-4 flex flex-wrap items-end gap-2 print:hidden"
      aria-label="Filtros dos lançamentos"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`${base}${entryFiltersQuery(f)}`, { scroll: false });
      }}
    >
      <label className="flex flex-col gap-1 text-caption text-ink-2">
        Período
        <Select value={f.period} onChange={(e) => set({ period: e.target.value as EntryFilters["period"] })} className="h-10 min-w-40 text-body-sm">
          {Object.entries(PERIODS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </label>
      {f.period === "personalizado" && (
        <>
          <label className="flex flex-col gap-1 text-caption text-ink-2">
            De
            <Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} className="h-10 text-body-sm" />
          </label>
          <label className="flex flex-col gap-1 text-caption text-ink-2">
            Até
            <Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} className="h-10 text-body-sm" />
          </label>
        </>
      )}
      {canRead && (
        <label className="flex flex-col gap-1 text-caption text-ink-2">
          Tipo
          <Select value={f.type} onChange={(e) => set({ type: e.target.value as EntryFilters["type"] })} className="h-10 min-w-40 text-body-sm">
            {Object.entries(TYPES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-caption text-ink-2">
        Situação
        <Select value={f.status} onChange={(e) => set({ status: e.target.value as EntryFilters["status"] })} className="h-10 min-w-36 text-body-sm">
          {Object.entries(STATUSES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-caption text-ink-2">
        Categoria
        <Select value={f.category} onChange={(e) => set({ category: e.target.value })} className="h-10 min-w-44 text-body-sm">
          <option value="">Todas</option>
          {visibleCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.type === "income" ? "Receita" : "Despesa"} · {c.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-caption text-ink-2">
        Buscar
        <Input type="search" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Descrição" className="h-10 w-44 text-body-sm" />
      </label>
      <Button type="submit" variant="secondary">
        Filtrar
      </Button>
    </form>
  );
}
