"use client";

import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { select, useDb } from "@/modules/clinic/client";
import { PatientPicker } from "@/modules/patients/components/patient-picker";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import type { Patient } from "@/prototype/types";
import { Button } from "@/ui/button";
import { Field, Input, Select, Textarea } from "@/ui/field";
import { Segmented } from "@/ui/primitives";
import { useToast } from "@/ui/toast";
import { money } from "@/lib/format";
import { saveEntry } from "../actions";
import { METHOD_LABEL, centsToDecimal, type Category, type Entry, type FinType, type PaymentMethod } from "../model";
import { parseMoney } from "../schemas";

export function EntryForm({
  categories, entry, initialType, canExpense, onDone,
}: {
  categories: Category[];
  entry?: Entry;
  initialType: FinType;
  canExpense: boolean;
  onDone: () => void;
}) {
  const db = useDb();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const today = format(new Date(), "yyyy-MM-dd");
  const hasSchedule = db.org.features.includes("schedule");

  const [type, setType] = useState<FinType>(entry?.type ?? initialType);
  const options = categories.filter((c) => c.type === type && (c.active || c.id === entry?.categoryId));
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? options[0]?.id ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [amount, setAmount] = useState(entry ? centsToDecimal(entry.amountCents) : "");
  const [dueDate, setDueDate] = useState(entry?.dueDate ?? today);
  const [paid, setPaid] = useState(entry ? entry.status === "paid" : false);
  const [paidAt, setPaidAt] = useState(entry?.paidAt ?? today);
  const [method, setMethod] = useState<PaymentMethod | "">(entry?.method ?? "pix");
  const [patient, setPatient] = useState<Patient | null>(() => select.patient(db, entry?.patientId ?? null) ?? null);
  const [professionalId, setProfessionalId] = useState(entry?.professionalId ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [repeat, setRepeat] = useState<"none" | "monthly" | "installments">("none");
  const [count, setCount] = useState("2");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<string>();

  const cents = parseMoney(amount);
  const n = Number.parseInt(count, 10);
  const preview =
    cents && repeat !== "none" && n >= 2 && n <= 60
      ? repeat === "installments"
        ? `${n} parcelas de ${money(Math.floor(cents / n))}${cents % n ? ` (a primeira com ${money(Math.floor(cents / n) + (cents % n))})` : ""}, uma por mês`
        : `${n} lançamentos de ${money(cents)}, um por mês`
      : null;

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveEntry(org, entry?.id ?? null, {
            type, categoryId, description, amount, dueDate, paid, paidAt: paid ? paidAt : "", method: paid ? method : "",
            patientId: patient?.id ?? "", professionalId, notes, repeat, count: repeat === "none" ? 1 : n || 0,
          });
          if (!r.ok) {
            setErrors(r.fields ?? {});
            setMessage(r.fields ? undefined : r.message);
            return;
          }
          toast({ message: entry ? "Lançamento salvo." : type === "income" ? "Receita lançada." : "Despesa lançada.", tone: "success" });
          onDone();
        });
      }}
    >
      {message && <FormNotice tone="danger">{message}</FormNotice>}

      {!entry && canExpense && (
        <Segmented
          label="Tipo de lançamento"
          value={type}
          onChange={(t) => {
            setType(t);
            setCategoryId(categories.find((c) => c.type === t && c.active)?.id ?? "");
          }}
          options={[
            { value: "income", label: "Receita" },
            { value: "expense", label: "Despesa" },
          ]}
        />
      )}

      <Field label="Descrição" error={errors.description} hint={type === "income" ? "Ex.: Consulta, Pacote de sessões." : "Ex.: Aluguel de março, Material de limpeza."}>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} autoFocus />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={repeat === "installments" ? "Valor total (R$)" : "Valor (R$)"} error={errors.amount}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </Field>
        <Field label="Categoria" error={errors.categoryId}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Vencimento" error={errors.dueDate} hint={repeat !== "none" ? "Data do primeiro; os próximos vencem no mesmo dia dos meses seguintes." : undefined}>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>

      <label className="flex items-center gap-3 text-body-sm font-medium">
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
        {type === "income" ? "Já foi recebido" : "Já foi pago"}
        {repeat !== "none" && <span className="font-normal text-ink-2">(só o primeiro)</span>}
      </label>
      {paid && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={type === "income" ? "Data do recebimento" : "Data do pagamento"} error={errors.paidAt}>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
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
        </div>
      )}

      {!entry && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Repetir" hint={preview ?? undefined}>
            <Select value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)}>
              <option value="none">Não repete</option>
              <option value="monthly">Todo mês</option>
              <option value="installments">Parcelado</option>
            </Select>
          </Field>
          {repeat !== "none" && (
            <Field label={repeat === "installments" ? "Número de parcelas" : "Quantos meses"} error={errors.count}>
              <Input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 2))} />
            </Field>
          )}
        </div>
      )}

      {hasSchedule && db.patients.length > 0 && (
        <div>
          <p className="mb-1.5 text-body-sm font-medium">
            Paciente <span className="font-normal text-ink-3">(opcional)</span>
          </p>
          <PatientPicker db={db} value={patient} onChange={setPatient} />
        </div>
      )}
      {select.activeProfessionals(db).length > 0 && (
        <Field label="Profissional" optional hint={type === "income" ? "Aparece no relatório por profissional." : undefined}>
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Nenhum</option>
            {select.activeProfessionals(db).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Observação" optional error={errors.notes} hint="Administrativa: número da nota, combinado com o fornecedor. Sem informação clínica.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={300} className="min-h-16" />
      </Field>

      <Button type="submit" size="lg" loading={pending}>
        {entry ? "Salvar lançamento" : type === "income" ? "Lançar receita" : "Lançar despesa"}
      </Button>
    </form>
  );
}
