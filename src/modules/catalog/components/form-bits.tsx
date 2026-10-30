"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Caixa de seleção com rótulo clicável e área de toque de 44 px. */
export function Check({ checked, onChange, children, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-sm py-2", disabled && "cursor-not-allowed opacity-60")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
      />
      <span className="text-body-sm">
        <span className="font-medium">{children}</span>
        {hint && <span className="block text-caption text-ink-2">{hint}</span>}
      </span>
    </label>
  );
}

/** Lista de caixas para escolher vários itens (serviços de um profissional e vice-versa). */
export function MultiCheck({ legend, items, value, onChange, empty }: { legend: string; items: { id: string; label: string; hint?: string }[]; value: string[]; onChange: (v: string[]) => void; empty: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1 text-body-sm font-medium">{legend}</legend>
      {items.length === 0 ? (
        <p className="text-body-sm text-ink-2">{empty}</p>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded-sm border border-line px-3">
          {items.map((i) => (
            <Check key={i.id} checked={value.includes(i.id)} hint={i.hint} onChange={(on) => onChange(on ? [...value, i.id] : value.filter((x) => x !== i.id))}>
              {i.label}
            </Check>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** Cores da agenda (tokens --agenda-1..8, contraste verificado em tokens.test.ts). */
export function ColorPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-body-sm font-medium">Cor na agenda</legend>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }, (_, i) => i + 1).map((c) => (
          <label key={c} className="relative cursor-pointer">
            <input type="radio" name="color" value={c} checked={value === c} onChange={() => onChange(c)} className="peer sr-only" />
            <span
              className="block size-9 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
              style={{ background: `var(--agenda-${c})` }}
            />
            <span className="sr-only">Cor {c}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
