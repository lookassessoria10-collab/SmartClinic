"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Check, Clock, Mail, MessageSquare, Phone, UserPlus, Users } from "lucide-react";
import { actions, select, useDb } from "@/prototype/store";
import type { Db } from "@/prototype/types";
import { Button } from "@/ui/button";
import { Field, Textarea } from "@/ui/field";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Card, EmptyState } from "@/ui/primitives";
import { Sheet } from "@/ui/sheet";
import { StatusBadge } from "@/ui/status-badge";
import { useToast } from "@/ui/toast";
import { dayLabel, expiresIn, fmt, phone, time } from "@/lib/format";
import { useMedia } from "@/lib/use-media";
import { cn } from "@/lib/cn";

export default function SolicitacoesPage() {
  return (
    <Suspense>
      <Queue />
    </Suspense>
  );
}

function Queue() {
  const db = useDb();
  const params = useSearchParams();
  const { org } = useParams<{ org: string }>();
  const mobile = useMedia("(max-width: 1023px)");
  const [selected, setSelected] = useState<string | null>(params.get("id"));
  if (!db) return null;

  const pending = select.pendingRequests(db);
  const current = selected && pending.some((a) => a.id === selected) ? selected : mobile ? null : pending[0]?.id ?? null;
  const answered = db.appointments
    .filter((a) => a.origin === "public" && select.request(db, a.id) && ["confirmed", "declined", "expired", "cancelled"].includes(a.status))
    .filter((a) => db.events.some((e) => e.appointmentId === a.id && e.to !== "requested"))
    .slice(-5)
    .reverse();

  return (
    <>
      <Link href={`/c/${org}/agenda`} className="mb-3 inline-flex h-9 items-center gap-1 rounded-sm pr-2 text-body-sm font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Agenda
      </Link>
      <h1 className="text-title-1 font-semibold">Solicitações</h1>
      <p className="mt-1 mb-6 text-body-sm text-ink-2">
        Pedidos feitos pela página pública. O horário fica reservado até a resposta ou até expirar ({db.org.settings.holdHours} h).
      </p>

      {pending.length === 0 ? (
        <Card>
          <EmptyState icon={Check} title="Nenhuma solicitação pendente" description="Quando um paciente pedir um horário pelo link, ele aparece aqui." />
        </Card>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
          <Card className="h-fit overflow-hidden">
            <ul aria-label="Solicitações pendentes, ordenadas pela expiração">
              {pending.map((a) => {
                const req = select.request(db, a.id)!;
                const active = a.id === current;
                return (
                  <li key={a.id} className="border-b border-line last:border-0">
                    <button
                      onClick={() => setSelected(a.id)}
                      aria-current={active || undefined}
                      className={cn("flex w-full flex-col gap-0.5 px-4 py-3.5 text-left transition-colors hover:bg-canvas", active && "bg-accent-subtle hover:bg-accent-subtle")}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{req.name}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-caption font-medium text-warning">
                          <Clock className="size-3.5" aria-hidden /> {expiresIn(a.holdExpiresAt!)}
                        </span>
                      </span>
                      <span className="truncate text-body-sm text-ink-2">
                        {select.service(db, a.serviceId).name} · {dayLabel(a.startsAt)} {time(a.startsAt)}
                      </span>
                      <span className="truncate text-caption text-ink-2">{select.professional(db, a.professionalId).name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {!mobile && current && (
            <Card className="p-5 sm:p-6">
              <Review key={current} db={db} id={current} onDone={() => setSelected(null)} />
            </Card>
          )}
        </div>
      )}

      {mobile && (
        <Sheet open={!!current} onOpenChange={(o) => !o && setSelected(null)} title="Revisar solicitação">
          {current && <Review key={current} db={db} id={current} onDone={() => setSelected(null)} />}
        </Sheet>
      )}

      {answered.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-headline font-semibold">Respondidas recentemente</h2>
          <Card>
            <ul className="divide-y divide-line">
              {answered.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-body-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{select.personName(db, a)}</span> · {select.service(db, a.serviceId).name} · {fmt(a.startsAt, "dd/MM HH:mm")}
                  </span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </>
  );
}

function Review({ db, id, onDone }: { db: Db; id: string; onDone: () => void }) {
  const toast = useToast();
  const a = db.appointments.find((x) => x.id === id)!;
  const req = select.request(db, id)!;
  const matches = select.matches(db, req.phone, req.email);
  const [link, setLink] = useState<string>(matches[0]?.id ?? "new");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const prof = select.professional(db, a.professionalId);
  const svc = select.service(db, a.serviceId);

  function approve() {
    const ok = actions.approve(id, link === "new" ? { create: { name: req.name, phone: req.phone, email: req.email } } : { patientId: link });
    if (!ok) return toast({ message: "Esta solicitação já foi respondida ou expirou.", tone: "danger" });
    toast({ message: `Confirmado: ${req.name}, ${dayLabel(a.startsAt).toLowerCase()} às ${time(a.startsAt)}.${req.email ? " O paciente será avisado por e-mail." : ""}`, tone: "success" });
    onDone();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-title-2 font-semibold">{req.name}</h2>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-ink-2">
            <span className="tabular inline-flex items-center gap-1.5"><Phone className="size-3.5" aria-hidden /> {phone(req.phone)}</span>
            {req.email && <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" aria-hidden /> {req.email}</span>}
          </p>
        </div>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-warning-subtle px-3 text-caption font-medium text-warning">
          <Clock className="size-3.5" aria-hidden /> Expira em {expiresIn(a.holdExpiresAt!)}
        </span>
      </div>

      <dl className="grid gap-3 rounded-md bg-canvas p-4 text-body-sm sm:grid-cols-3">
        <div>
          <dt className="text-caption text-ink-2">Serviço</dt>
          <dd className="font-medium">{svc.name}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-2">Quando</dt>
          <dd className="tabular font-medium">{dayLabel(a.startsAt)}, {time(a.startsAt)}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-2">Profissional</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-full" style={{ background: `var(--agenda-${prof.color})` }} aria-hidden /> {prof.name}
          </dd>
        </div>
      </dl>

      {req.message && (
        <p className="flex gap-2 text-body-sm">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
          <span>“{req.message}”</span>
        </p>
      )}

      <fieldset>
        <legend className="mb-2 flex items-center gap-1.5 text-body-sm font-semibold">
          <Users className="size-4 text-ink-2" aria-hidden /> Cadastro do paciente
        </legend>
        {matches.length > 0 && (
          <p className="mb-2 text-body-sm text-ink-2">Encontramos {matches.length === 1 ? "um cadastro" : "cadastros"} com o mesmo telefone ou e-mail.</p>
        )}
        <div className="flex flex-col gap-2">
          {matches.map((p) => (
            <Option key={p.id} checked={link === p.id} onChange={() => setLink(p.id)} title={`Vincular a ${p.name}`} subtitle={`${phone(p.phone)}${p.email ? ` · ${p.email}` : ""}`} />
          ))}
          <Option checked={link === "new"} onChange={() => setLink("new")} title="Criar novo paciente" subtitle={`${req.name} · ${phone(req.phone)}`} icon />
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" className="text-danger hover:bg-danger-subtle hover:text-danger" onClick={() => setDeclineOpen(true)}>
          Recusar
        </Button>
        <Button size="lg" onClick={approve}>
          <Check className="size-4" aria-hidden /> Aprovar
        </Button>
      </div>

      <ConfirmDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        destructive
        title="Recusar solicitação?"
        description="O horário será liberado. O paciente verá a recusa no link de acompanhamento."
        confirmLabel="Recusar"
        onConfirm={() => {
          actions.decline(id, reason || undefined);
          toast({ message: "Solicitação recusada e horário liberado.", tone: "info" });
          onDone();
        }}
      >
        <Field label="Mensagem ao paciente" optional>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Não temos este horário. Pode escolher outro dia?" rows={3} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}

function Option({ checked, onChange, title, subtitle, icon }: { checked: boolean; onChange: () => void; title: string; subtitle: string; icon?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 rounded-sm border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent", checked ? "border-accent bg-accent-subtle" : "border-line hover:bg-canvas")}>
      <input type="radio" name="link" checked={checked} onChange={onChange} className="size-4 accent-[var(--color-accent)]" />
      {icon && <UserPlus className="size-4 text-ink-2" aria-hidden />}
      <span className="min-w-0">
        <span className="block text-body-sm font-medium">{title}</span>
        <span className="tabular block truncate text-caption text-ink-2">{subtitle}</span>
      </span>
    </label>
  );
}
