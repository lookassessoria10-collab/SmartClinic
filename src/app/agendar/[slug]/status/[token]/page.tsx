"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Ban, CheckCircle2, Clock, Link2Off, TimerOff, XCircle, type LucideIcon } from "lucide-react";
import { PublicHeader } from "@/modules/public-booking/components/public-header";
import { actions, select, useDb } from "@/prototype/store";
import type { AppointmentStatus } from "@/prototype/types";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { EmptyState, Skeleton } from "@/ui/primitives";
import { useToast } from "@/ui/toast";
import { cap, fmt, phone, time } from "@/lib/format";
import { cn } from "@/lib/cn";

const VIEW: Partial<Record<AppointmentStatus, { icon: LucideIcon; title: string; text: string; tone: string }>> = {
  requested: { icon: Clock, title: "Aguardando confirmação", text: "A clínica ainda não respondeu. O horário está reservado para você.", tone: "bg-warning-subtle text-warning" },
  confirmed: { icon: CheckCircle2, title: "Confirmado", text: "Seu horário está confirmado. Até lá!", tone: "bg-success-subtle text-success" },
  completed: { icon: CheckCircle2, title: "Atendimento concluído", text: "Obrigado pela visita.", tone: "bg-muted text-ink-2" },
  declined: { icon: XCircle, title: "Não foi possível confirmar", text: "A clínica não pôde atender neste horário.", tone: "bg-danger-subtle text-danger" },
  expired: { icon: TimerOff, title: "Não confirmada a tempo", text: "A solicitação expirou e o horário foi liberado.", tone: "bg-muted text-ink-2" },
  cancelled: { icon: Ban, title: "Cancelado", text: "Este agendamento foi cancelado.", tone: "bg-muted text-ink-2" },
  no_show: { icon: XCircle, title: "Não comparecimento registrado", text: "Fale com a clínica se houve engano.", tone: "bg-muted text-ink-2" },
};

export default function StatusPage() {
  const db = useDb();
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);

  if (!db) return <div className="mx-auto max-w-xl p-4"><Skeleton className="h-40" /></div>;

  // Mesma resposta para token inexistente ou vencido (não revela se o link já existiu — S4).
  const req = db.requests.find((r) => r.token === token);
  const a = req && db.appointments.find((x) => x.id === req.appointmentId);

  return (
    <div className="min-h-dvh">
      <PublicHeader org={db.org} />
      <main className="mx-auto max-w-xl px-4 py-6">
        {!a || !req ? (
          <EmptyState icon={Link2Off} title="Link inválido ou expirado" description="Confira se copiou o endereço completo ou faça uma nova solicitação." action={<Link href={`/agendar/${slug}`} className="font-medium text-accent underline underline-offset-2">Agendar novamente</Link>} />
        ) : (
          (() => {
            const v = VIEW[a.status]!;
            const prof = select.professional(db, a.professionalId);
            return (
              <div className="flex flex-col gap-4">
                <h1 className="sr-only">Status da sua solicitação</h1>
                <div className={cn("flex items-start gap-3 rounded-lg p-5", v.tone)} role="status">
                  <v.icon className="mt-0.5 size-6 shrink-0" aria-hidden />
                  <div>
                    <p className="text-headline font-semibold">{v.title}</p>
                    <p className="mt-0.5 text-body-sm">{v.text}</p>
                    {a.status === "declined" && req.declineReason && <p className="mt-2 text-body-sm">Mensagem da clínica: “{req.declineReason}”</p>}
                  </div>
                </div>

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-md border border-line bg-surface p-5 text-body-sm">
                  <dt className="text-ink-2">Serviço</dt>
                  <dd className="font-medium">{select.service(db, a.serviceId).name}</dd>
                  <dt className="text-ink-2">Quando</dt>
                  <dd className="tabular font-medium">{cap(fmt(a.startsAt, "EEEE, d 'de' MMMM"))} · {time(a.startsAt)}</dd>
                  <dt className="text-ink-2">Profissional</dt>
                  <dd className="font-medium">{prof.name}</dd>
                  <dt className="text-ink-2">Clínica</dt>
                  <dd>
                    {db.org.name} · <a className="tabular text-accent underline-offset-2 hover:underline" href={`tel:${db.org.phone}`}>{phone(db.org.phone)}</a>
                  </dd>
                </dl>

                {(a.status === "requested" || a.status === "confirmed") && new Date(a.startsAt) > new Date() && (
                  <Button variant="secondary" className="text-danger" onClick={() => setConfirm(true)}>
                    {a.status === "requested" ? "Cancelar solicitação" : "Cancelar agendamento"}
                  </Button>
                )}
                {["declined", "expired", "cancelled"].includes(a.status) && (
                  <Link href={`/agendar/${slug}`} className="inline-flex h-12 items-center justify-center rounded-sm bg-accent text-body font-medium text-on-accent hover:bg-accent-hover">
                    Escolher outro horário
                  </Link>
                )}

                <ConfirmDialog
                  open={confirm}
                  onOpenChange={setConfirm}
                  destructive
                  title="Cancelar?"
                  description="O horário será liberado para outras pessoas."
                  confirmLabel="Sim, cancelar"
                  onConfirm={() => {
                    actions.cancelByToken(token);
                    toast({ message: "Cancelado. A clínica foi avisada.", tone: "info" });
                  }}
                />
              </div>
            );
          })()
        )}
      </main>
    </div>
  );
}
