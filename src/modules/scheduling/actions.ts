"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase";
import { requireMember } from "@/server/auth";
import { dbErrorMessage, type Result } from "@/modules/clinic/errors";

/*
 * Agenda (Fase 5). As regras de verdade estão nas funções do banco (migração 0012):
 * permissão própria × de todos, horário de atendimento, bloqueios, conflito, transições.
 */

const uuid = z.uuid();
const refresh = (slug: string) => revalidatePath(`/c/${slug}`, "layout");

const createSchema = z.object({
  professionalId: uuid,
  serviceId: uuid,
  patientId: uuid,
  startsAt: z.iso.datetime({ offset: true }),
  notes: z.string().trim().max(2000).optional(),
});

export async function createAppointment(slug: string, input: z.input<typeof createSchema>): Promise<Result<{ id: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revise os dados do agendamento." };
  const ctx = await requireMember(slug);
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_appointment", {
    p_org: ctx.organization.id,
    p_professional: v.professionalId,
    p_service: v.serviceId,
    p_patient: v.patientId,
    p_starts_at: v.startsAt,
    p_notes: v.notes || undefined,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true, data: { id: data } };
}

export async function rescheduleAppointment(slug: string, id: string, startsAt: string): Promise<Result> {
  if (!uuid.safeParse(id).success || !z.iso.datetime({ offset: true }).safeParse(startsAt).success) {
    return { ok: false, message: "Horário inválido." };
  }
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reschedule_appointment", { p_id: id, p_starts_at: startsAt });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}

const statusSchema = z.enum(["completed", "no_show", "cancelled"]);

export async function setAppointmentStatus(slug: string, id: string, to: string, reason?: string): Promise<Result> {
  const s = statusSchema.safeParse(to);
  if (!uuid.safeParse(id).success || !s.success) return { ok: false, message: "Ação inválida." };
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_appointment_status", {
    p_id: id,
    p_to: s.data,
    p_reason: reason?.slice(0, 200) || undefined,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}
