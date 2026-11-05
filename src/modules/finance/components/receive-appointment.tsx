"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { CheckCircle2, Wallet } from "lucide-react";
import { select, useDb } from "@/modules/clinic/client";
import { can, useSession } from "@/components/session-context";
import type { Appointment } from "@/prototype/types";
import { Button } from "@/ui/button";
import { Field, Input, Select } from "@/ui/field";
import { useToast } from "@/ui/toast";
import { receiveAppointment } from "../actions";
import { METHOD_LABEL, centsToDecimal, type PaymentMethod } from "../model";

/**
 * "Registrar recebimento" no painel do atendimento (com o Financeiro ligado): cria a receita
 * paga ligada ao atendimento, ao paciente e ao profissional. Um recebimento por atendimento.
 */
export function ReceiveAppointment({ appointment }: { appointment: Appointment }) {
  const db = useDb();
  const session = useSession();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const price = select.service(db, appointment.serviceId).priceCents;
  const [amount, setAmount] = useState(price != null ? centsToDecimal(price) : "");
  const [paidAt, setPaidAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [method, setMethod] = useState<PaymentMethod | "">("pix");
  const [error, setError] = useState<string>();

  if (!db.org.features.includes("finance") || !["completed", "confirmed"].includes(appointment.status)) return null;
  const receipt = db.receipts[appointment.id];
  if (receipt) {
    return (
      <p className="flex items-center gap-2 rounded-sm bg-success-subtle p-3 text-body-sm text-success">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        {receipt.status === "paid" ? "Recebimento registrado." : "Recebimento lançado, ainda pendente."}
        {can(session, "finance.write") && (
          <Link href={`/c/${org}/financeiro`} className="ml-auto font-medium underline underline-offset-2">
            Ver no Financeiro
          </Link>
        )}
      </p>
    );
  }
  if (!can(session, "finance.write")) return null;

  if (!open) {
    return (
      <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        <Wallet className="size-4" aria-hidden /> Registrar recebimento
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-sm border border-line p-3"
      aria-label="Registrar recebimento"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await receiveAppointment(org, { appointmentId: appointment.id, amount, paidAt, method });
          if (!r.ok) return setError(r.message);
          toast({ message: "Recebimento registrado no Financeiro.", tone: "success" });
          setOpen(false);
        });
      }}
    >
      {error && <p role="alert" className="text-body-sm text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)" hint={price != null ? "Preço do serviço; ajuste se precisar." : undefined}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" autoFocus />
        </Field>
        <Field label="Data">
          <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </Field>
      </div>
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
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Confirmar recebimento
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
