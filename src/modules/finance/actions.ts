"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase";
import { requireMember } from "@/server/auth";
import { fieldErrors } from "@/modules/auth/schemas";
import { dbErrorMessage, type Result } from "@/modules/clinic/errors";
import { categorySchema, entrySchema, modulesSchema, parseMoney, paySchema, receiveSchema, type EntryInput } from "./schemas";

/*
 * Financeiro e módulos (docs/19). As funções do banco (0016) conferem permissão (gestão × recepção),
 * módulo ligado, organização e transições; aqui só validamos a forma dos dados.
 */

const uuid = z.uuid();
const refresh = (slug: string) => revalidatePath(`/c/${slug}`, "layout");

export async function saveEntry(slug: string, id: string | null, input: EntryInput): Promise<Result<{ id: string }>> {
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, message: "Revise os dados." };
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: "Revise os campos destacados." };
  const ctx = await requireMember(slug);
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_financial_entry", {
    p_org: ctx.organization.id,
    p_id: id,
    p_type: v.type,
    p_category: v.categoryId,
    p_description: v.description,
    p_amount_cents: v.amountCents,
    p_due_date: v.dueDate,
    p_paid_at: v.paidAt ?? undefined,
    p_method: v.method ?? undefined,
    p_patient: v.patientId ?? undefined,
    p_professional: v.professionalId ?? undefined,
    p_notes: v.notes || undefined,
    p_repeat: id ? "none" : v.repeat,
    p_count: id ? 1 : v.count,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true, data: { id: data } };
}

export async function payEntry(slug: string, input: z.input<typeof paySchema>): Promise<Result> {
  const parsed = paySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Informe a data do pagamento." };
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_financial_entry_status", {
    p_id: parsed.data.id, p_status: "paid", p_paid_at: parsed.data.paidAt, p_method: parsed.data.method ?? undefined,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

/** Voltar a pendente (desfazer pagamento) ou cancelar — opcionalmente os próximos da série. */
export async function changeEntryStatus(slug: string, id: string, status: "pending" | "cancelled", following = false): Promise<Result<{ count: number }>> {
  if (!uuid.safeParse(id).success || !["pending", "cancelled"].includes(status)) return { ok: false, message: "Revise os dados." };
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_financial_entry_status", { p_id: id, p_status: status, p_following: following });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true, data: { count: data } };
}

/** "Registrar recebimento" no atendimento (agenda). */
export async function receiveAppointment(slug: string, input: z.input<typeof receiveSchema>): Promise<Result> {
  const parsed = receiveSchema.safeParse(input);
  const cents = parsed.success ? parseMoney(parsed.data.amount) : null;
  if (!parsed.success || cents == null || cents < 1) return { ok: false, message: "Informe o valor e a data do recebimento." };
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("receive_appointment", {
    p_appointment: parsed.data.appointmentId, p_amount_cents: cents, p_paid_at: parsed.data.paidAt, p_method: parsed.data.method,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

export async function saveCategory(slug: string, input: z.input<typeof categorySchema>): Promise<Result> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: "Revise o nome da categoria." };
  const ctx = await requireMember(slug);
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_financial_category", {
    p_org: ctx.organization.id, p_id: v.id, p_type: v.type, p_name: v.name, p_active: v.active,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

/** Gestão → Módulos. Desligar esconde o módulo; nenhum dado é apagado. */
export async function setModules(slug: string, modules: string[]): Promise<Result> {
  const parsed = modulesSchema.safeParse(modules);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revise os módulos." };
  const ctx = await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_organization_modules", { p_org: ctx.organization.id, p_modules: parsed.data });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}
