"use client";

import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Stethoscope } from "lucide-react";
import { useDb } from "@/modules/clinic/client";
import { saveProfessional } from "@/modules/catalog/actions";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import type { Professional } from "@/prototype/types";
import { Card, EmptyState, PageHeader } from "@/ui/primitives";
import { Badge } from "@/ui/status-badge";
import { Button } from "@/ui/button";
import { Field, Input, Select } from "@/ui/field";
import { Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";
import { Check, ColorPicker, MultiCheck } from "./form-bits";

interface Member {
  userId: string;
  name: string;
}

export function ProfessionalsManager({ writable, members }: { writable: boolean; members: Member[] }) {
  const db = useDb();
  const [editing, setEditing] = useState<Professional | "new" | null>(null);
  const linkedName = (userId: string | null) => members.find((m) => m.userId === userId)?.name;

  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Quem atende na clínica. Cada profissional tem a própria agenda, serviços e horários."
        actions={
          <Button onClick={() => setEditing("new")} disabled={!writable}>
            <Plus className="size-4" aria-hidden /> Novo profissional
          </Button>
        }
      />
      {!writable && (
        <div className="mb-4">
          <FormNotice tone="info">A clínica está em modo somente leitura.</FormNotice>
        </div>
      )}

      <Card>
        {db.professionals.length === 0 ? (
          <EmptyState icon={Stethoscope} title="Nenhum profissional ainda" description="Cadastre quem atende para montar a agenda." />
        ) : (
          <ul className="divide-y divide-line">
            {db.professionals.map((p) => {
              const services = db.services.filter((s) => s.active && s.professionalIds.includes(p.id));
              const hasHours = db.availability.some((r) => r.professionalId === p.id);
              return (
                <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <span className="hidden size-3 shrink-0 rounded-full sm:block" style={{ background: `var(--agenda-${p.color})` }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {p.name}
                      {!p.active && <Badge>Inativo</Badge>}
                      {p.userId && <Badge className="bg-accent-subtle text-accent">Conta: {linkedName(p.userId) ?? "membro"}</Badge>}
                    </p>
                    <p className="text-body-sm text-ink-2">
                      {[p.specialty, p.councilType && p.councilNumber ? `${p.councilType} ${p.councilNumber}` : null].filter(Boolean).join(" · ") || "Sem especialidade"}
                    </p>
                    <p className="mt-0.5 text-caption text-ink-3">
                      {services.length ? services.map((s) => s.name).join(", ") : "Nenhum serviço"}
                      {!hasHours && " · sem horário de atendimento"}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(p)} disabled={!writable} aria-label={`Editar ${p.name}`}>
                    <Pencil className="size-3.5" aria-hidden /> Editar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "Novo profissional" : "Editar profissional"}>
        {editing !== null && (
          <ProfessionalForm
            key={editing === "new" ? "new" : editing.id}
            professional={editing === "new" ? undefined : editing}
            members={members}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </>
  );
}

function ProfessionalForm({ professional: p, members, onDone }: { professional?: Professional; members: Member[]; onDone: () => void }) {
  const db = useDb();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(p?.name ?? "");
  const [specialty, setSpecialty] = useState(p?.specialty ?? "");
  const [councilType, setCouncilType] = useState(p?.councilType ?? "");
  const [councilNumber, setCouncilNumber] = useState(p?.councilNumber ?? "");
  const [color, setColor] = useState(p?.color ?? ((db.professionals.length % 8) + 1));
  const [userId, setUserId] = useState(p?.userId ?? "");
  const [active, setActive] = useState(p?.active ?? true);
  const [acceptsPublic, setAcceptsPublic] = useState(p?.acceptsPublic ?? true);
  const [serviceIds, setServiceIds] = useState(() => db.services.filter((s) => p && s.professionalIds.includes(p.id)).map((s) => s.id));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<string>();
  // Uma conta só pode estar ligada a um profissional.
  const taken = new Set(db.professionals.filter((x) => x.userId && x.id !== p?.id).map((x) => x.userId));

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveProfessional(org, p?.id ?? null, {
            name, specialty, councilType, councilNumber, color, userId: userId || null, active, acceptsPublic, serviceIds,
          });
          if (!r.ok) {
            setErrors(r.fields ?? {});
            setMessage(r.message);
            return;
          }
          toast({ message: p ? "Profissional atualizado." : `${name.trim()} cadastrado(a).`, tone: "success" });
          onDone();
        });
      }}
    >
      {message && <FormNotice tone="danger">{message}</FormNotice>}
      <Field label="Nome de exibição" error={errors.name} hint="Como aparece na agenda e para o paciente. Ex.: Dra. Ana Ribeiro">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" />
      </Field>
      <Field label="Especialidade" optional error={errors.specialty}>
        <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex.: Dentista — clínica geral" />
      </Field>
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Field label="Conselho" optional>
          <Input value={councilType} onChange={(e) => setCouncilType(e.target.value.toUpperCase())} placeholder="CRO" maxLength={20} />
        </Field>
        <Field label="Número" optional>
          <Input value={councilNumber} onChange={(e) => setCouncilNumber(e.target.value)} placeholder="12345-SP" maxLength={30} />
        </Field>
      </div>
      <Field
        label="Conta na equipe"
        optional
        error={errors.userId}
        hint="Ligue à conta de quem atende para a pessoa ver a própria agenda. Deixe vazio se ela não usa o sistema."
      >
        <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Não usa o sistema</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId} disabled={taken.has(m.userId)}>
              {m.name}
              {taken.has(m.userId) ? " (já ligado a outro profissional)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <ColorPicker value={color} onChange={setColor} />
      <MultiCheck
        legend="Serviços que realiza"
        items={db.services.filter((s) => s.active).map((s) => ({ id: s.id, label: s.name, hint: `${s.durationMin} min` }))}
        value={serviceIds}
        onChange={setServiceIds}
        empty="Nenhum serviço cadastrado. Cadastre em Gestão → Serviços e volte aqui."
      />
      <div>
        <Check checked={acceptsPublic} onChange={setAcceptsPublic} hint="Quando o agendamento online estiver ligado.">
          Aceita agendamento online
        </Check>
        {p && (
          <Check checked={active} onChange={setActive} hint="Inativo some da agenda e dos agendamentos novos; o histórico fica.">
            Ativo
          </Check>
        )}
      </div>
      <Button type="submit" size="lg" loading={pending}>
        {p ? "Salvar alterações" : "Cadastrar profissional"}
      </Button>
    </form>
  );
}
