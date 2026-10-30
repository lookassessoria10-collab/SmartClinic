"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/server/supabase";
import { requireMember } from "@/server/auth";
import type { Database } from "@/server/database.types";
import { fieldErrors } from "@/modules/auth/schemas";
import { dbErrorMessage, type Result } from "@/modules/clinic/errors";
import {
  blockSchema, professionalSchema, serviceSchema, weeklyRulesSchema,
  type BlockInput, type ProfessionalInput, type ServiceInput, type WeeklyRule,
} from "./schemas";

/*
 * Gestão → Profissionais, Serviços e Horários (Fases 4–5).
 * Permissões conferidas pela RLS (professionals.manage, services.manage, availability.*).
 */

const refresh = (slug: string) => revalidatePath(`/c/${slug}`, "layout");
const validId = (id: string | null) => id === null || z.uuid().safeParse(id).success;

/** Deixa a tabela de vínculo igual à lista pedida (remove o que saiu, inclui o que entrou). */
async function syncLinks(
  supabase: SupabaseClient<Database>,
  org: string,
  side: "professional_id" | "service_id",
  id: string,
  wanted: string[],
) {
  const other = side === "professional_id" ? "service_id" : "professional_id";
  const { data: current, error } = await supabase.from("professional_services").select(other).eq(side, id);
  if (error) return error;
  const have = new Set((current ?? []).map((r) => (r as Record<string, string>)[other]));
  const want = new Set(wanted);
  const remove = [...have].filter((x) => !want.has(x));
  const add = [...want].filter((x) => !have.has(x));
  if (remove.length) {
    const { error: e } = await supabase.from("professional_services").delete().eq(side, id).in(other, remove);
    if (e) return e;
  }
  if (add.length) {
    const rows = add.map((x) => ({
      organization_id: org,
      professional_id: side === "professional_id" ? id : x,
      service_id: side === "service_id" ? id : x,
    }));
    const { error: e } = await supabase.from("professional_services").insert(rows);
    if (e) return e;
  }
  return null;
}

export async function saveProfessional(slug: string, id: string | null, input: ProfessionalInput): Promise<Result<{ id: string }>> {
  const parsed = professionalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: "Revise os campos destacados." };
  if (!validId(id)) return { ok: false, message: "Profissional inválido." };
  const ctx = await requireMember(slug);
  const v = parsed.data;
  const row = {
    display_name: v.name,
    specialty: v.specialty || null,
    council_type: v.councilType || null,
    council_number: v.councilNumber || null,
    color: v.color,
    accepts_public_booking: v.acceptsPublic,
    user_id: v.userId,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = id
    ? await supabase.from("professionals").update({ ...row, active: v.active }).eq("id", id).select("id").single()
    : await supabase.from("professionals").insert({ ...row, organization_id: ctx.organization.id }).select("id").single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, fields: { userId: "Esta pessoa já está ligada a outro profissional." } };
    return { ok: false, message: dbErrorMessage(error) };
  }

  const linkError = await syncLinks(supabase, ctx.organization.id, "professional_id", data.id, v.serviceIds);
  refresh(slug);
  if (linkError) return { ok: false, message: `Profissional salvo, mas os serviços não: ${dbErrorMessage(linkError)}` };
  return { ok: true, data: { id: data.id } };
}

export async function saveService(slug: string, id: string | null, input: ServiceInput): Promise<Result<{ id: string }>> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: "Revise os campos destacados." };
  if (!validId(id)) return { ok: false, message: "Serviço inválido." };
  const ctx = await requireMember(slug);
  const v = parsed.data;
  const row = {
    name: v.name,
    category: v.category || null,
    duration_min: v.durationMin,
    buffer_after_min: v.bufferAfterMin,
    price_cents: v.priceCents,
    is_public: v.isPublic,
    show_price_publicly: v.showPrice,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = id
    ? await supabase.from("services").update({ ...row, active: v.active }).eq("id", id).select("id").single()
    : await supabase.from("services").insert({ ...row, organization_id: ctx.organization.id }).select("id").single();
  if (error || !data) return { ok: false, message: dbErrorMessage(error) };

  const linkError = await syncLinks(supabase, ctx.organization.id, "service_id", data.id, v.professionalIds);
  refresh(slug);
  if (linkError) return { ok: false, message: `Serviço salvo, mas os profissionais não: ${dbErrorMessage(linkError)}` };
  return { ok: true, data: { id: data.id } };
}

export async function saveWeeklyAvailability(slug: string, professionalId: string, rules: WeeklyRule[]): Promise<Result> {
  const parsed = weeklyRulesSchema.safeParse(rules);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Horários inválidos." };
  if (!validId(professionalId)) return { ok: false, message: "Profissional inválido." };
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_weekly_availability", { p_professional: professionalId, p_rules: parsed.data });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

export async function addBlock(slug: string, input: BlockInput): Promise<Result> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: "Revise os campos destacados." };
  const ctx = await requireMember(slug);
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("schedule_blocks").insert({
    organization_id: ctx.organization.id,
    professional_id: v.professionalId,
    kind: v.kind,
    starts_at: v.startsAt,
    ends_at: v.endsAt,
    reason: v.reason || null,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

export async function removeBlock(slug: string, id: string): Promise<Result> {
  if (!validId(id)) return { ok: false, message: "Bloqueio inválido." };
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase.from("schedule_blocks").delete({ count: "exact" }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!count) return { ok: false, message: "Você não tem permissão para remover este bloqueio." };
  refresh(slug);
  return { ok: true };
}
