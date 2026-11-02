"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { differenceInCalendarDays } from "date-fns";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { select, useDb } from "@/modules/clinic/client";
import { can, useSession } from "@/components/session-context";
import { PatientPicker } from "@/modules/patients/components/patient-picker";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import { parsePrice } from "@/modules/catalog/schemas";
import type { Patient, Proposal } from "@/prototype/types";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Field, Input, Select } from "@/ui/field";
import { Card, EmptyState, PageHeader } from "@/ui/primitives";
import { Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";
import { fmt, money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { saveProposal, setProposalStatus } from "../actions";
import { OpportunitiesNav } from "./opportunities-nav";

const STATUS: Record<Proposal["status"], { label: string; className: string }> = {
  open: { label: "Em aberto", className: "bg-accent-subtle text-accent" },
  accepted: { label: "Aceito", className: "bg-success-subtle text-success" },
  declined: { label: "Recusado", className: "bg-muted text-ink-2" },
  cancelled: { label: "Cancelado", className: "bg-muted text-ink-2" },
  expired: { label: "Vencido", className: "bg-muted text-ink-2" },
};
const centsToInput = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
const day = (iso: string) => fmt(`${iso}T12:00`, "dd/MM/yyyy");

type Editing = { proposal?: Proposal; patientId?: string } | null;
type Closing = { proposal: Proposal; status: "accepted" | "declined" | "cancelled" } | null;

export function ProposalsManager() {
  const db = useDb();
  const session = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [, start] = useTransition();
  const canWriteAll = can(session, "proposals.write");
  const canWriteOwn = can(session, "proposals.write_own");
  const [editing, setEditing] = useState<Editing>(() => (params.get("novo") === "1" ? { patientId: params.get("paciente") ?? undefined } : null));
  const [closing, setClosing] = useState<Closing>(null);
  useEffect(() => {
    if (params.get("novo") === "1") router.replace(`/c/${org}/inicio/oportunidades/orcamentos`);
  }, [params, org, router]);

  const writable = (p: Proposal) => canWriteAll || (canWriteOwn && !!p.professionalId && p.professionalId === db.viewer.professionalId);
  const open = db.proposals.filter((p) => p.status === "open");
  const closed = db.proposals.filter((p) => p.status !== "open");

  const row = (p: Proposal) => {
    const patient = select.patient(db, p.patientId);
    const idle = differenceInCalendarDays(new Date(), new Date(p.lastActivityAt));
    const stale = p.status === "open" && idle >= db.opportunitySettings.proposalStaleDays;
    return (
      <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {p.title}
            <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-caption font-medium", STATUS[p.status].className)}>{STATUS[p.status].label}</span>
          </p>
          <p className="text-body-sm text-ink-2">
            {patient?.name ?? "Paciente"}
            {p.professionalId && ` · ${select.professional(db, p.professionalId).name}`}
            {` · ${p.items.length} ${p.items.length === 1 ? "item" : "itens"}`}
          </p>
          <p className={cn("tabular text-caption", stale ? "font-medium text-warning" : "text-ink-2")}>
            {p.status === "open"
              ? `${idle === 0 ? "Atualizado hoje" : `Sem atualização há ${idle} ${idle === 1 ? "dia" : "dias"}`}${p.validUntil ? ` · válido até ${day(p.validUntil)}` : ""}`
              : `Criado em ${fmt(p.createdAt, "dd/MM/yyyy")}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <span className="tabular mr-2 font-semibold">{money(p.totalCents)}</span>
          {p.status === "open" && writable(p) && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing({ proposal: p })} aria-label={`Editar orçamento ${p.title}`}>
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setClosing({ proposal: p, status: "accepted" })} aria-label={`Marcar orçamento ${p.title} como aceito`}>
                Aceito
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setClosing({ proposal: p, status: "declined" })} aria-label={`Marcar orçamento ${p.title} como recusado`}>
                Recusado
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setClosing({ proposal: p, status: "cancelled" })} aria-label={`Cancelar orçamento ${p.title}`}>
                Cancelar
              </Button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <OpportunitiesNav />
      <PageHeader
        title="Orçamentos"
        description="Propostas administrativas por paciente, sem dados clínicos. Orçamento em aberto não é receita garantida nem perdida."
        actions={
          (canWriteAll || canWriteOwn) && (
            <Button onClick={() => setEditing({})}>
              <Plus className="size-4" aria-hidden /> Novo orçamento
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        {open.length === 0 ? (
          <EmptyState icon={Receipt} title="Nenhum orçamento em aberto" description={`Orçamentos sem atualização há ${db.opportunitySettings.proposalStaleDays} dias aparecem nas Oportunidades para acompanhamento.`} />
        ) : (
          <ul className="divide-y divide-line">{open.map(row)}</ul>
        )}
      </Card>

      {closed.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-body-sm font-medium text-ink-2">Fechados ({closed.length})</summary>
          <Card className="mt-2 overflow-hidden">
            <ul className="divide-y divide-line">{closed.map(row)}</ul>
          </Card>
        </details>
      )}

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing?.proposal ? "Editar orçamento" : "Novo orçamento"} description="O total é calculado pelo sistema a partir dos itens.">
        {editing && <ProposalForm key={editing.proposal?.id ?? "new"} editing={editing} onDone={() => setEditing(null)} />}
      </Sheet>

      <ConfirmDialog
        open={closing !== null}
        onOpenChange={(o) => !o && setClosing(null)}
        destructive={closing?.status === "cancelled"}
        title={closing?.status === "accepted" ? "Marcar como aceito?" : closing?.status === "declined" ? "Marcar como recusado?" : "Cancelar orçamento?"}
        description={`${closing?.proposal.title ?? ""} · ${money(closing?.proposal.totalCents)}. Depois de fechado, o orçamento não pode ser editado.`}
        confirmLabel={closing?.status === "accepted" ? "Aceito" : closing?.status === "declined" ? "Recusado" : "Cancelar orçamento"}
        onConfirm={() =>
          start(async () => {
            if (!closing) return;
            const r = await setProposalStatus(org, closing.proposal.id, closing.status);
            toast({ message: r.ok ? "Orçamento atualizado." : (r.message ?? "Não foi possível atualizar."), tone: r.ok ? "success" : "danger" });
            setClosing(null);
          })
        }
      />
    </>
  );
}

interface ItemDraft {
  key: number;
  serviceId: string;
  description: string;
  quantity: string;
  price: string;
}

function ProposalForm({ editing, onDone }: { editing: NonNullable<Editing>; onDone: () => void }) {
  const db = useDb();
  const session = useSession();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const p = editing.proposal;
  const ownOnly = !can(session, "proposals.write") ? db.viewer.professionalId : null;
  const [patient, setPatient] = useState<Patient | null>(() => select.patient(db, p?.patientId ?? editing.patientId ?? null) ?? null);
  const [professionalId, setProfessionalId] = useState(p?.professionalId ?? ownOnly ?? "");
  const [title, setTitle] = useState(p?.title ?? "");
  const [validUntil, setValidUntil] = useState(p?.validUntil ?? "");
  const [items, setItems] = useState<ItemDraft[]>(() =>
    p?.items.length
      ? p.items.map((i, k) => ({ key: k, serviceId: i.serviceId ?? "", description: i.description, quantity: String(i.quantity), price: centsToInput(i.unitPriceCents) }))
      : [{ key: 0, serviceId: "", description: "", quantity: "1", price: "" }],
  );
  const [message, setMessage] = useState<string>();
  const services = db.services.filter((s) => s.active);

  const parsed = items.map((i) => ({ ...i, cents: parsePrice(i.price), qty: Number.parseInt(i.quantity, 10) }));
  const total = parsed.reduce((s, i) => s + (i.cents ?? 0) * (Number.isFinite(i.qty) ? i.qty : 0), 0);
  const update = (key: number, patch: Partial<ItemDraft>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!patient) return setMessage("Escolha o paciente.");
        if (parsed.some((i) => i.cents == null || !Number.isFinite(i.qty) || i.qty < 1)) return setMessage("Cada item precisa de quantidade e valor (ex.: 150,00).");
        start(async () => {
          const r = await saveProposal(org, p?.id ?? null, {
            patientId: patient.id,
            professionalId,
            title,
            validUntil,
            items: parsed.map((i) => ({ serviceId: i.serviceId, description: i.description, quantity: i.qty, unitPriceCents: i.cents ?? 0 })),
          });
          if (!r.ok) return setMessage(r.message);
          toast({ message: p ? "Orçamento salvo." : "Orçamento criado.", tone: "success" });
          onDone();
        });
      }}
    >
      {message && <FormNotice tone="danger">{message}</FormNotice>}
      {p ? (
        <p className="font-medium">{patient?.name}</p>
      ) : (
        <PatientPicker db={db} value={patient} onChange={setPatient} autoFocus={!editing.patientId} />
      )}

      <Field label="Nome do orçamento" hint="Administrativo, ex.: “Plano de clareamento”. Sem diagnóstico.">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Profissional" optional={!ownOnly}>
          <Select value={professionalId} disabled={!!ownOnly} onChange={(e) => setProfessionalId(e.target.value)}>
            {!ownOnly && <option value="">Nenhum</option>}
            {select.activeProfessionals(db).filter((x) => !ownOnly || x.id === ownOnly).map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Válido até" optional>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-body-sm font-medium">Itens</legend>
        {items.map((i, n) => (
          <div key={i.key} className="flex flex-wrap items-end gap-2 rounded-sm border border-line p-2">
            <Field label={`Serviço ou descrição do item ${n + 1}`} className="min-w-0 basis-full sm:flex-1 sm:basis-0">
              <Select
                value={i.serviceId}
                onChange={(e) => {
                  const s = services.find((x) => x.id === e.target.value);
                  update(i.key, { serviceId: e.target.value, price: s && !i.price ? centsToInput(s.priceCents) : i.price, description: s ? "" : i.description });
                }}
              >
                <option value="">Outro (descrever)</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Qtd." className="w-20">
              <Input inputMode="numeric" value={i.quantity} onChange={(e) => update(i.key, { quantity: e.target.value.replace(/\D/g, "") })} />
            </Field>
            <Field label="Valor (R$)" className="min-w-28 flex-1 sm:w-32 sm:flex-none">
              <Input inputMode="decimal" value={i.price} onChange={(e) => update(i.key, { price: e.target.value })} placeholder="0,00" />
            </Field>
            <Button
              size="icon"
              variant="ghost"
              disabled={items.length === 1}
              onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}
              aria-label={`Remover item ${n + 1}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
            {!i.serviceId && (
              <Field label="Descrição" className="basis-full">
                <Input value={i.description} onChange={(e) => update(i.key, { description: e.target.value })} maxLength={120} placeholder="Ex.: material" />
              </Field>
            )}
          </div>
        ))}
        <Button
          variant="ghost"
          className="self-start"
          disabled={items.length >= 50}
          onClick={() => setItems((list) => [...list, { key: Math.max(...list.map((x) => x.key)) + 1, serviceId: "", description: "", quantity: "1", price: "" }])}
        >
          <Plus className="size-4" aria-hidden /> Adicionar item
        </Button>
      </fieldset>

      <p className="flex items-center justify-between rounded-sm bg-canvas px-3 py-2 text-body-sm">
        <span className="text-ink-2">Total</span>
        <span className="tabular text-headline font-semibold">{money(total)}</span>
      </p>

      <Button type="submit" size="lg" loading={pending}>
        {p ? "Salvar orçamento" : "Criar orçamento"}
      </Button>
    </form>
  );
}
