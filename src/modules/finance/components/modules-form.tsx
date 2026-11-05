"use client";

import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarCheck, Check, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import { useDb } from "@/modules/clinic/client";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import { Button } from "@/ui/button";
import { PageHeader } from "@/ui/primitives";
import { useToast } from "@/ui/toast";
import { cn } from "@/lib/cn";
import { setModules } from "../actions";
import { MODULES, type ModuleKey } from "../model";

const ICON: Record<ModuleKey, LucideIcon> = { schedule: CalendarCheck, opportunities: Sparkles, finance: Wallet };

/** Gestão → Módulos: o que a clínica usa. Desligar esconde do menu; nenhum dado é apagado. */
export function ModulesForm({ writable }: { writable: boolean }) {
  const db = useDb();
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<ModuleKey[]>(db.org.features);
  const [error, setError] = useState<string>();
  const changed = chosen.length !== db.org.features.length || chosen.some((m) => !db.org.features.includes(m));

  const toggle = (m: ModuleKey) =>
    setChosen((all) => (all.includes(m) ? all.filter((x) => x !== m && !(m === "schedule" && x === "opportunities")) : [...all, m]));

  return (
    <>
      <PageHeader title="Módulos" description="Escolha o que a clínica usa. Desligar esconde o módulo do menu de todos — os dados ficam guardados e voltam quando você ligar de novo." />
      <form
        className="flex max-w-2xl flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await setModules(org, chosen);
            if (!r.ok) return setError(r.message);
            setError(undefined);
            toast({ message: "Módulos atualizados.", tone: "success" });
          });
        }}
      >
        {error && <FormNotice tone="danger">{error}</FormNotice>}
        {!writable && <FormNotice tone="info">Clínica em modo somente leitura.</FormNotice>}
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Módulos da clínica</legend>
          {MODULES.map((m) => {
            const on = chosen.includes(m.key);
            const blocked = !!m.requires && !chosen.includes(m.requires);
            const Icon = ICON[m.key];
            return (
              <label
                key={m.key}
                className={cn(
                  "flex min-h-16 cursor-pointer items-center gap-3 rounded-md border bg-surface p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                  on ? "border-accent bg-accent-subtle shadow-[0_0_0_1px_var(--color-accent)]" : "border-line hover:border-line-strong",
                  blocked && "cursor-not-allowed opacity-60",
                )}
              >
                <input type="checkbox" className="sr-only" checked={on} disabled={blocked || !writable} onChange={() => toggle(m.key)} />
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-sm", on ? "bg-accent text-on-accent" : "bg-muted text-ink-2")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-body-sm text-ink-2">{blocked ? "Precisa da Agenda e pacientes." : m.description}</span>
                </span>
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-sm border", on ? "border-accent bg-accent text-on-accent" : "border-line-strong")} aria-hidden>
                  {on && <Check className="size-3" />}
                </span>
              </label>
            );
          })}
        </fieldset>
        <Button type="submit" size="lg" loading={pending} disabled={!writable || !changed || chosen.length === 0} className="self-start">
          Salvar módulos
        </Button>
      </form>
    </>
  );
}
