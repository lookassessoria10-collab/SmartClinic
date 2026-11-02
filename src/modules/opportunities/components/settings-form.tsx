"use client";

import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { select, useDb } from "@/modules/clinic/client";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import type { OpportunityKind, OpportunitySettings } from "@/prototype/types";
import { Button } from "@/ui/button";
import { Field, Input, Select } from "@/ui/field";
import { Card, CardHeader, PageHeader } from "@/ui/primitives";
import { useToast } from "@/ui/toast";
import { saveOpportunitySettings } from "../actions";
import { KIND_META, KIND_ORDER } from "../labels";

/** Configuração da clínica (docs/17 §3, §5). Os padrões já servem; nada aqui é obrigatório. */
export function OpportunitySettingsForm({ writable }: { writable: boolean }) {
  const db = useDb();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const s = db.opportunitySettings;
  const [enabled, setEnabled] = useState<OpportunityKind[]>(s.enabledKinds);
  const [staleDays, setStaleDays] = useState(String(s.proposalStaleDays));
  const [horizon, setHorizon] = useState(String(s.slotHorizonDays));
  const [lead, setLead] = useState(String(s.followUpLeadDays));
  const [priorities, setPriorities] = useState<OpportunitySettings["priorityOverrides"]>(s.priorityOverrides);
  const [excluded, setExcluded] = useState<string[]>(s.excludedProfessionalIds);
  const [receptionValues, setReceptionValues] = useState(s.receptionSeesValues);
  const [prosOwn, setProsOwn] = useState(s.professionalsSeeOwn);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<string>();
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <>
      <PageHeader title="Oportunidades" description="O que o sistema acompanha para a sua clínica. Os padrões já funcionam; ajuste só se precisar." />
      <form
        className="flex max-w-3xl flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveOpportunitySettings(org, {
              enabledKinds: enabled,
              proposalStaleDays: Number(staleDays),
              slotHorizonDays: Number(horizon),
              followUpLeadDays: Number(lead),
              priorityOverrides: priorities,
              excludedProfessionalIds: excluded,
              receptionSeesValues: receptionValues,
              professionalsSeeOwn: prosOwn,
            });
            if (!r.ok) {
              setErrors(r.fields ?? {});
              setMessage(r.message);
              return;
            }
            setErrors({});
            setMessage(undefined);
            toast({ message: "Configurações salvas. As oportunidades serão recalculadas.", tone: "success" });
          });
        }}
      >
        {message && <FormNotice tone="danger">{message}</FormNotice>}
        {!writable && <FormNotice tone="info">Clínica em modo somente leitura.</FormNotice>}

        <Card>
          <CardHeader title="O que acompanhar" description="Desligar um tipo esconde as oportunidades dele; nada é apagado." />
          <ul className="divide-y divide-line border-t border-line">
            {KIND_ORDER.map((k) => {
              const Icon = KIND_META[k].icon;
              const on = enabled.includes(k);
              return (
                <li key={k} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <label className="flex items-center gap-3 text-body-sm font-medium">
                    <input type="checkbox" checked={on} onChange={() => setEnabled(toggle(enabled, k))} className="size-4 accent-[var(--color-accent)]" />
                    <Icon className="size-4 text-ink-2" aria-hidden />
                    {KIND_META[k].label}
                  </label>
                  <label className="flex items-center gap-2 text-caption text-ink-2">
                    Prioridade
                    <Select
                      value={String(priorities[k] ?? "")}
                      disabled={!on}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPriorities((p) => {
                          const next = { ...p };
                          if (v) next[k] = Number(v) as 1 | 2 | 3;
                          else delete next[k];
                          return next;
                        });
                      }}
                      className="h-9 min-w-40 text-body-sm"
                    >
                      <option value="">Padrão do segmento</option>
                      <option value="1">Alta</option>
                      <option value="2">Média</option>
                      <option value="3">Baixa</option>
                    </Select>
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Prazos" />
          <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-3">
            <Field label="Horários livres: dias à frente" error={errors.slotHorizonDays} hint="De 1 a 30.">
              <Input inputMode="numeric" value={horizon} onChange={(e) => setHorizon(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Orçamento parado após (dias)" error={errors.proposalStaleDays} hint="De 1 a 90.">
              <Input inputMode="numeric" value={staleDays} onChange={(e) => setStaleDays(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Avisar retorno com antecedência (dias)" error={errors.followUpLeadDays} hint="De 0 a 90.">
              <Input inputMode="numeric" value={lead} onChange={(e) => setLead(e.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Profissionais incluídos" description="Quem fica de fora não gera horários livres nem acompanhamentos." />
          <ul className="grid gap-2 border-t border-line p-5 sm:grid-cols-2">
            {select.activeProfessionals(db).map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-3 text-body-sm">
                  <input type="checkbox" checked={!excluded.includes(p.id)} onChange={() => setExcluded(toggle(excluded, p.id))} className="size-4 accent-[var(--color-accent)]" />
                  {p.name}
                </label>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Quem vê o quê" description="A gestão sempre vê tudo. A lista de espera segue as permissões da agenda." />
          <div className="flex flex-col gap-3 border-t border-line p-5 text-body-sm">
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={receptionValues} onChange={(e) => setReceptionValues(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
              <span>
                <span className="font-medium">Recepção vê valores estimados</span>
                <span className="block text-ink-2">Receita potencial dos horários livres. Orçamentos a recepção já vê, porque é ela quem os registra.</span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={prosOwn} onChange={(e) => setProsOwn(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
              <span>
                <span className="font-medium">Profissionais veem as próprias oportunidades</span>
                <span className="block text-ink-2">Só as ligadas à agenda e aos pacientes de cada um.</span>
              </span>
            </label>
          </div>
        </Card>

        <Button type="submit" size="lg" loading={pending} disabled={!writable} className="self-start">
          Salvar configurações
        </Button>
      </form>
    </>
  );
}
