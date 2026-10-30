"use client";

import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Tags } from "lucide-react";
import { useDb } from "@/modules/clinic/client";
import { saveService } from "@/modules/catalog/actions";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import type { Service } from "@/prototype/types";
import { Card, EmptyState, PageHeader } from "@/ui/primitives";
import { Badge } from "@/ui/status-badge";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";
import { Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";
import { money } from "@/lib/format";
import { Check, MultiCheck } from "./form-bits";

const centsToInput = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

export function ServicesManager({ writable }: { writable: boolean }) {
  const db = useDb();
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const proName = (id: string) => db.professionals.find((p) => p.id === id)?.name;

  return (
    <>
      <PageHeader
        title="Serviços"
        description="O que a clínica oferece. A duração (mais o intervalo) define o tamanho do horário na agenda."
        actions={
          <Button onClick={() => setEditing("new")} disabled={!writable}>
            <Plus className="size-4" aria-hidden /> Novo serviço
          </Button>
        }
      />
      {!writable && (
        <div className="mb-4">
          <FormNotice tone="info">A clínica está em modo somente leitura.</FormNotice>
        </div>
      )}

      <Card className="overflow-x-auto">
        {db.services.length === 0 ? (
          <EmptyState icon={Tags} title="Nenhum serviço ainda" description="Cadastre o primeiro serviço para poder agendar." />
        ) : (
          <table className="w-full min-w-[640px] text-body-sm">
            <thead className="bg-canvas text-left text-caption text-ink-2">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Serviço</th>
                <th scope="col" className="px-5 py-3 font-semibold">Duração</th>
                <th scope="col" className="px-5 py-3 font-semibold">Preço</th>
                <th scope="col" className="px-5 py-3 font-semibold">Quem realiza</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {db.services.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {s.name}
                      {!s.active && <Badge>Inativo</Badge>}
                    </span>
                    {s.category && <span className="text-caption text-ink-3">{s.category}</span>}
                  </td>
                  <td className="tabular px-5 py-3 text-ink-2">
                    {s.durationMin} min{s.bufferAfterMin ? ` + ${s.bufferAfterMin} de intervalo` : ""}
                  </td>
                  <td className="tabular px-5 py-3 text-ink-2">{money(s.priceCents)}</td>
                  <td className="px-5 py-3 text-ink-2">
                    {s.professionalIds.length ? s.professionalIds.map(proName).filter(Boolean).join(", ") : <span className="text-warning">Ninguém — não aparece na agenda</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(s)} disabled={!writable} aria-label={`Editar ${s.name}`}>
                      <Pencil className="size-3.5" aria-hidden /> Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "Novo serviço" : "Editar serviço"}>
        {editing !== null && <ServiceForm key={editing === "new" ? "new" : editing.id} service={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}

function ServiceForm({ service: s, onDone }: { service?: Service; onDone: () => void }) {
  const db = useDb();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(s?.name ?? "");
  const [category, setCategory] = useState(s?.category ?? "");
  const [durationMin, setDuration] = useState(String(s?.durationMin ?? 30));
  const [bufferAfterMin, setBuffer] = useState(String(s?.bufferAfterMin ?? 0));
  const [price, setPrice] = useState(centsToInput(s?.priceCents ?? null));
  const [isPublic, setIsPublic] = useState(s?.isPublic ?? true);
  const [showPrice, setShowPrice] = useState(s?.showPrice ?? false);
  const [active, setActive] = useState(s?.active ?? true);
  // Novo serviço já vem marcado para todos os profissionais ativos (o mais comum em clínica pequena).
  const [professionalIds, setProfessionalIds] = useState(() => s?.professionalIds ?? db.professionals.filter((p) => p.active).map((p) => p.id));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<string>();

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveService(org, s?.id ?? null, {
            name, category, durationMin, bufferAfterMin, price, isPublic, showPrice, active, professionalIds,
          });
          if (!r.ok) {
            setErrors(r.fields ?? {});
            setMessage(r.message);
            return;
          }
          toast({ message: s ? "Serviço atualizado." : `${name.trim()} cadastrado.`, tone: "success" });
          onDone();
        });
      }}
    >
      {message && <FormNotice tone="danger">{message}</FormNotice>}
      <Field label="Nome do serviço" error={errors.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" placeholder="Ex.: Avaliação" />
      </Field>
      <Field label="Categoria" optional>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Consulta, Procedimento, Sessão, Retorno…" list="categorias" />
      </Field>
      <datalist id="categorias">
        {["Consulta", "Procedimento", "Sessão", "Retorno", "Exame"].map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duração (min)" error={errors.durationMin}>
          <Input type="number" inputMode="numeric" min={5} max={720} step={5} value={durationMin} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <Field label="Intervalo depois (min)" error={errors.bufferAfterMin} hint="Limpeza, preparo da sala.">
          <Input type="number" inputMode="numeric" min={0} max={120} step={5} value={bufferAfterMin} onChange={(e) => setBuffer(e.target.value)} />
        </Field>
      </div>
      <Field label="Preço (R$)" optional error={errors.price} hint="Usado na estimativa do Início. Ex.: 150,00">
        <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
      </Field>
      <MultiCheck
        legend="Profissionais que realizam"
        items={db.professionals.filter((p) => p.active).map((p) => ({ id: p.id, label: p.name, hint: p.specialty || undefined }))}
        value={professionalIds}
        onChange={setProfessionalIds}
        empty="Nenhum profissional cadastrado. Cadastre em Gestão → Profissionais."
      />
      <div>
        <Check checked={isPublic} onChange={setIsPublic} hint="Quando o agendamento online estiver ligado.">
          Aparece no agendamento online
        </Check>
        <Check checked={showPrice} onChange={setShowPrice} disabled={!isPublic}>
          Mostrar o preço para o paciente
        </Check>
        {s && (
          <Check checked={active} onChange={setActive} hint="Inativo não aparece para novos agendamentos; o histórico fica.">
            Ativo
          </Check>
        )}
      </div>
      <Button type="submit" size="lg" loading={pending}>
        {s ? "Salvar alterações" : "Cadastrar serviço"}
      </Button>
    </form>
  );
}
