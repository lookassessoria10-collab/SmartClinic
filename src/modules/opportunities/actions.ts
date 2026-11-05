"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase";
import { requireMember } from "@/server/auth";
import { fieldErrors } from "@/modules/auth/schemas";
import { dbErrorMessage, type Result } from "@/modules/clinic/errors";
import type { OpportunityDetail } from "@/prototype/types";
import {
  assignSchema, contactSchema, followUpSchema, proposalSchema, settingsSchema, statusSchema, waitingSchema,
  type FollowUpInput, type ProposalInput, type SettingsInput, type WaitingInput,
} from "./schemas";

/*
 * Oportunidades (docs/17). Tudo passa pela sessão da pessoa: as funções do banco (0014–0015)
 * conferem permissão, organização e transição; aqui só validamos a forma dos dados.
 */

const uuid = z.uuid();
const refresh = (slug: string) => revalidatePath(`/c/${slug}`, "layout");
const invalid = { ok: false, message: "Revise os dados." } as const;

/** Botão "Atualizar": recalcula agora, sem esperar a próxima abertura. */
export async function refreshOpportunities(slug: string): Promise<Result> {
  const ctx = await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("opportunities_feed", { p_org: ctx.organization.id, p_force: true, p_limit: 1 });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

export async function getOpportunityDetail(slug: string, id: string): Promise<Result<OpportunityDetail>> {
  if (!uuid.safeParse(id).success) return invalid;
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("opportunity_detail", { p_id: id });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  return { ok: true, data: data as unknown as OpportunityDetail };
}

export async function logContact(slug: string, input: z.input<typeof contactSchema>): Promise<Result> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: "Escolha o resultado do contato." };
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("opportunity_log_contact", {
    p_id: parsed.data.id, p_outcome: parsed.data.outcome, p_note: parsed.data.note ?? undefined,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

export async function setOpportunityStatus(slug: string, input: z.input<typeof statusSchema>): Promise<Result> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: "Informe o motivo do descarte." };
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("opportunity_set_status", {
    p_id: parsed.data.id, p_status: parsed.data.status, p_reason: parsed.data.reason || undefined,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

export async function assignOpportunity(slug: string, input: z.input<typeof assignSchema>): Promise<Result> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return invalid;
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("opportunity_assign", { p_id: parsed.data.id, p_user: parsed.data.userId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

/* ---------- Lista de espera ---------- */

export async function saveWaitingEntry(slug: string, id: string | null, input: WaitingInput): Promise<Result> {
  if (id !== null && !uuid.safeParse(id).success) return invalid;
  const parsed = waitingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: "Revise os campos destacados." };
  const ctx = await requireMember(slug);
  const v = parsed.data;
  const row = {
    service_id: v.serviceId, professional_id: v.professionalId, weekdays: v.weekdays, periods: v.periods,
    earliest_date: v.earliestDate, latest_date: v.latestDate, notes: v.notes,
  };
  const supabase = await createSupabaseServerClient();
  const { error } = id
    ? await supabase.from("waiting_list").update(row).eq("id", id)
    : await supabase.from("waiting_list").insert({ ...row, organization_id: ctx.organization.id, patient_id: v.patientId });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Este paciente já está na lista de espera para este serviço e profissional." };
    return { ok: false, message: dbErrorMessage(error) };
  }
  refresh(slug);
  return { ok: true };
}

export async function setWaitingEntryStatus(slug: string, id: string, status: "removed" | "waiting"): Promise<Result> {
  if (!uuid.safeParse(id).success || !["removed", "waiting"].includes(status)) return invalid;
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("waiting_list").update({ status }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

/** Agenda um paciente da lista: agendamento e baixa na lista na mesma transação (0015). */
export async function bookWaitingEntry(
  slug: string,
  input: { entryId: string; professionalId: string; serviceId: string; startsAt: string; opportunityId?: string },
): Promise<Result<{ id: string }>> {
  const parsed = z
    .object({ entryId: uuid, professionalId: uuid, serviceId: uuid, startsAt: z.iso.datetime({ offset: true }), opportunityId: uuid.optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revise os dados do agendamento." };
  await requireMember(slug);
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("book_from_waiting_list", {
    p_entry: v.entryId, p_professional: v.professionalId, p_service: v.serviceId, p_starts_at: v.startsAt, p_opportunity: v.opportunityId,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true, data: { id: data } };
}

/* ---------- Retornos ---------- */

export async function saveFollowUp(slug: string, id: string | null, input: FollowUpInput): Promise<Result> {
  if (id !== null && !uuid.safeParse(id).success) return invalid;
  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: "Revise os campos destacados." };
  const ctx = await requireMember(slug);
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = id
    ? await supabase.from("follow_ups").update({ due_date: v.dueDate, service_id: v.serviceId }).eq("id", id)
    : await supabase.from("follow_ups").insert({
        organization_id: ctx.organization.id, patient_id: v.patientId, professional_id: v.professionalId,
        service_id: v.serviceId, due_date: v.dueDate, source_appointment_id: v.sourceAppointmentId,
      });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

export async function setFollowUpStatus(slug: string, id: string, status: "done" | "cancelled" | "pending"): Promise<Result> {
  if (!uuid.safeParse(id).success || !["done", "cancelled", "pending"].includes(status)) return invalid;
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("follow_ups").update({ status }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

/* ---------- Orçamentos ---------- */

export async function saveProposal(slug: string, id: string | null, input: ProposalInput): Promise<Result<{ id: string }>> {
  if (id !== null && !uuid.safeParse(id).success) return invalid;
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const ctx = await requireMember(slug);
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_proposal", {
    p_org: ctx.organization.id,
    p_id: id,
    p_patient: v.patientId,
    p_professional: v.professionalId,
    p_title: v.title,
    p_valid_until: v.validUntil,
    p_items: v.items.map((i) => ({ service_id: i.serviceId, description: i.description, quantity: i.quantity, unit_price_cents: i.unitPriceCents })),
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true, data: { id: data } };
}

export async function setProposalStatus(slug: string, id: string, status: "accepted" | "declined" | "cancelled"): Promise<Result> {
  if (!uuid.safeParse(id).success || !["accepted", "declined", "cancelled"].includes(status)) return invalid;
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_proposal_status", { p_id: id, p_status: status });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

/* ---------- Configurações (gestão) ---------- */

export async function saveOpportunitySettings(slug: string, input: SettingsInput): Promise<Result> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: "Revise os campos destacados." };
  const ctx = await requireMember(slug);
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_opportunity_settings", {
    p_org: ctx.organization.id,
    p_enabled: v.enabledKinds,
    p_stale_days: v.proposalStaleDays,
    p_horizon_days: v.slotHorizonDays,
    p_lead_days: v.followUpLeadDays,
    p_priorities: v.priorityOverrides,
    p_excluded: v.excludedProfessionalIds,
    p_reception_sees_values: v.receptionSeesValues,
    p_professionals_see_own: v.professionalsSeeOwn,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}
