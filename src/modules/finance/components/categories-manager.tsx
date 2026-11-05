"use client";

import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDownCircle, ArrowUpCircle, Pencil, Plus } from "lucide-react";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";
import { Card, CardHeader, PageHeader } from "@/ui/primitives";
import { useToast } from "@/ui/toast";
import { cn } from "@/lib/cn";
import { saveCategory } from "../actions";
import type { Category, FinType } from "../model";
import { FinanceNav } from "./finance-nav";

/** Categorias de receita e despesa (gestão). Desativar esconde dos novos lançamentos; o histórico fica. */
export function CategoriesManager({ categories, writable }: { categories: Category[]; writable: boolean }) {
  return (
    <>
      <FinanceNav />
      <PageHeader title="Categorias" description="Organizam os lançamentos e o relatório. Desativar não apaga: só some dos novos lançamentos." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Column type="income" categories={categories.filter((c) => c.type === "income")} writable={writable} />
        <Column type="expense" categories={categories.filter((c) => c.type === "expense")} writable={writable} />
      </div>
    </>
  );
}

function Column({ type, categories, writable }: { type: FinType; categories: Category[]; writable: boolean }) {
  const { org } = useParams<{ org: string }>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const label = type === "income" ? "Receitas" : "Despesas";

  const save = (input: { id?: string; name: string; active?: boolean }, ok: string, after?: () => void) =>
    start(async () => {
      const r = await saveCategory(org, { id: input.id ?? "", type, name: input.name, active: input.active ?? true });
      if (!r.ok) {
        setError(r.fields?.name ?? r.message);
        return;
      }
      setError(undefined);
      toast({ message: ok, tone: "success" });
      after?.();
    });

  return (
    <Card>
      <CardHeader title={label} icon={type === "income" ? ArrowUpCircle : ArrowDownCircle} />
      <ul className="divide-y divide-line border-t border-line">
        {categories.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5">
            {editing?.id === c.id ? (
              <form
                className="flex flex-1 flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  save({ id: c.id, name: editing.name, active: c.active }, "Categoria renomeada.", () => setEditing(null));
                }}
              >
                <Field label={`Novo nome para ${c.name}`} className="min-w-48 flex-1">
                  <Input value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} maxLength={60} autoFocus />
                </Field>
                <Button type="submit" size="sm" loading={pending}>
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Voltar
                </Button>
              </form>
            ) : (
              <>
                <span className={cn("flex-1 text-body-sm font-medium", !c.active && "text-ink-3")}>
                  {c.name}
                  {!c.active && <span className="ml-2 text-caption font-normal">(desativada)</span>}
                </span>
                {writable && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: c.id, name: c.name })} aria-label={`Renomear ${c.name}`}>
                      <Pencil className="size-4" aria-hidden /> Renomear
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => save({ id: c.id, name: c.name, active: !c.active }, c.active ? "Categoria desativada." : "Categoria reativada.")}
                      aria-label={`${c.active ? "Desativar" : "Reativar"} ${c.name}`}
                    >
                      {c.active ? "Desativar" : "Reativar"}
                    </Button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {writable && (
        <form
          className="flex items-end gap-2 border-t border-line p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save({ name }, "Categoria criada.", () => setName(""));
          }}
        >
          <Field label={`Nova categoria de ${label.toLowerCase()}`} error={error} className="flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={type === "income" ? "Ex.: Convênios" : "Ex.: Manutenção"} />
          </Field>
          <Button type="submit" variant="secondary" loading={pending} aria-label={`Adicionar categoria de ${label.toLowerCase()}`}>
            <Plus className="size-4" aria-hidden /> Adicionar
          </Button>
        </form>
      )}
    </Card>
  );
}
