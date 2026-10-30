"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { Search, UserPlus, X } from "lucide-react";
import { savePatient } from "@/modules/patients/actions";
import type { Db, Patient } from "@/prototype/types";
import { Avatar } from "@/ui/primitives";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";
import { maskPhone, phone, toE164 } from "@/lib/format";
import { cn } from "@/lib/cn";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca por nome ou telefone, com criação inline quando não encontra (docs/05 F2). */
export function PatientPicker({ db, value, onChange, autoFocus }: { db: Db; value: Patient | null; onChange: (p: Patient | null) => void; autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string>();
  const [saving, start] = useTransition();
  const { org } = useParams<{ org: string }>();
  const listId = useId();

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    const digits = q.replace(/\D/g, "");
    return db.patients
      .filter((p) => normalize(p.name).includes(q) || (digits.length >= 3 && p.phone.includes(digits)))
      .slice(0, 6);
  }, [db.patients, query]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-sm border border-line-strong bg-surface px-3 py-2">
        <Avatar name={value.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-medium">{value.name}</p>
          <p className="tabular text-caption text-ink-2">{value.phone ? phone(value.phone) : "Sem telefone"}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-muted" aria-label="Trocar paciente">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-3 rounded-sm border border-accent bg-accent-subtle/40 p-3">
        <p className="text-body-sm font-medium">Novo paciente</p>
        <Field label="Nome completo">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        </Field>
        <Field label="Celular" error={phoneError}>
          <Input inputMode="tel" autoComplete="off" value={newPhone} onChange={(e) => setNewPhone(maskPhone(e.target.value))} placeholder="(11) 90000-0000" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            loading={saving}
            onClick={() => {
              const e164 = toE164(newPhone);
              if (!e164) return setPhoneError("Informe um celular com DDD.");
              const dup = db.patients.find((p) => p.phone === e164);
              if (dup) return setPhoneError(`Este telefone já está no cadastro de ${dup.name}. Busque pelo nome.`);
              start(async () => {
                const r = await savePatient(org, null, { name: query, phone: newPhone });
                if (r.ok && r.data) onChange(r.data);
                else setPhoneError(r.fields?.phone ?? r.fields?.name ?? r.message);
              });
            }}
            disabled={query.trim().length < 3}
          >
            Cadastrar e usar
          </Button>
        </div>
      </div>
    );
  }

  const options = [...results.map((p) => ({ kind: "patient" as const, p })), ...(query.trim().length >= 3 ? [{ kind: "create" as const }] : [])];

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-[38px] left-3 size-4 text-ink-3" aria-hidden />
      <Field label="Paciente" hint="Busque por nome ou telefone.">
        <Input
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-activedescendant={options.length ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          autoComplete="off"
          className="pl-9"
          value={query}
          placeholder="Ex.: Mariana ou 90000"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter" && options[active]) {
              e.preventDefault();
              const o = options[active];
              if (o.kind === "patient") onChange(o.p);
              else setCreating(true);
            }
          }}
        />
      </Field>
      {options.length > 0 && (
        <ul id={listId} role="listbox" className="mt-1 overflow-hidden rounded-sm border border-line bg-surface shadow-md">
          {options.map((o, i) => (
            <li
              key={o.kind === "patient" ? o.p.id : "create"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                if (o.kind === "patient") onChange(o.p);
                else setCreating(true);
              }}
              className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5 text-body-sm", i === active && "bg-accent-subtle")}
            >
              {o.kind === "patient" ? (
                <>
                  <Avatar name={o.p.name} size="sm" />
                  <span className="flex-1 truncate font-medium">{o.p.name}</span>
                  <span className="tabular text-caption text-ink-2">{phone(o.p.phone)}</span>
                </>
              ) : (
                <>
                  <span className="grid size-7 place-items-center rounded-full bg-accent text-on-accent">
                    <UserPlus className="size-3.5" aria-hidden />
                  </span>
                  <span>
                    Cadastrar <strong className="font-semibold">“{query.trim()}”</strong> como novo paciente
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
