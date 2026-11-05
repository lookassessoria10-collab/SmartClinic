import "server-only";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/database.types";
import type { Category, Entry, EntryFilters, PaymentMethod } from "./model";

/*
 * Leitura do Financeiro com a sessão da pessoa (a RLS decide: recepção só recebe receitas).
 * Filtro por período: entra o que vence OU foi pago no período; "atrasados" ignora o período.
 */

type Client = SupabaseClient<Database>;

export const ENTRY_COLUMNS =
  "id, type, category_id, description, amount_cents, due_date, paid_at, status, payment_method, patient_id, professional_id, appointment_id, notes, series_id, repeat_kind, installment, installments";

type Row = Pick<
  Database["public"]["Tables"]["financial_entries"]["Row"],
  | "id" | "type" | "category_id" | "description" | "amount_cents" | "due_date" | "paid_at" | "status" | "payment_method"
  | "patient_id" | "professional_id" | "appointment_id" | "notes" | "series_id" | "repeat_kind" | "installment" | "installments"
>;

export function toEntry(r: Row): Entry {
  return {
    id: r.id,
    type: r.type,
    categoryId: r.category_id,
    description: r.description,
    amountCents: r.amount_cents,
    dueDate: r.due_date,
    paidAt: r.paid_at,
    status: r.status,
    method: (r.payment_method as PaymentMethod | null) ?? null,
    patientId: r.patient_id,
    professionalId: r.professional_id,
    appointmentId: r.appointment_id,
    notes: r.notes,
    seriesId: r.series_id,
    repeatKind: (r.repeat_kind as Entry["repeatKind"]) ?? null,
    installment: r.installment,
    installments: r.installments,
  };
}

export async function loadCategories(supabase: Client, orgId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("financial_categories")
    .select("id, type, name, active")
    .eq("organization_id", orgId)
    .order("position")
    .order("name");
  if (error) throw new Error(`Falha ao carregar categorias: ${error.message}`);
  return data;
}

export const LIST_LIMIT = 500;

/** Lançamentos do filtro (até LIST_LIMIT), mais recentes por vencimento primeiro. */
export async function loadEntries(supabase: Client, orgId: string, f: EntryFilters, today = format(new Date(), "yyyy-MM-dd")) {
  let q = supabase.from("financial_entries").select(ENTRY_COLUMNS).eq("organization_id", orgId);
  if (f.status === "atrasados") q = q.eq("status", "pending").lt("due_date", today);
  else {
    q = q.or(`and(due_date.gte.${f.from},due_date.lte.${f.to}),and(paid_at.gte.${f.from},paid_at.lte.${f.to})`);
    if (f.status === "pendentes") q = q.eq("status", "pending");
    if (f.status === "pagos") q = q.eq("status", "paid");
    if (f.status === "cancelados") q = q.eq("status", "cancelled");
  }
  if (f.type === "receitas") q = q.eq("type", "income");
  if (f.type === "despesas") q = q.eq("type", "expense");
  if (f.category) q = q.eq("category_id", f.category);
  // Busca na descrição; curingas do LIKE escapados.
  if (f.q) q = q.ilike("description", `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, error } = await q.order("due_date", { ascending: false }).order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw new Error(`Falha ao carregar lançamentos: ${error.message}`);
  return data.map(toEntry);
}
