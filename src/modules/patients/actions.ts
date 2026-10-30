"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase";
import { requireMember } from "@/server/auth";
import { fieldErrors } from "@/modules/auth/schemas";
import { dbErrorMessage, type Result } from "@/modules/clinic/errors";
import type { Patient } from "@/prototype/types";
import { patientSchema, type PatientInput } from "./schemas";

/*
 * Pacientes (Fase 4). A RLS decide quem vê e quem altera (profissional: só os próprios, D-06);
 * exclusão é lógica e auditada (função delete_patient).
 */

const refresh = (slug: string) => revalidatePath(`/c/${slug}`, "layout");

export async function savePatient(slug: string, id: string | null, input: PatientInput): Promise<Result<Patient>> {
  const parsed = patientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error), message: "Revise os campos destacados." };
  if (id && !z.uuid().safeParse(id).success) return { ok: false, message: "Paciente inválido." };
  const ctx = await requireMember(slug);
  const v = parsed.data;
  const row = {
    full_name: v.name,
    phone_e164: v.phone,
    email: v.email || null,
    birth_date: v.birthDate || null,
    admin_notes: v.notes || null,
  };

  const supabase = await createSupabaseServerClient();
  const query = id
    ? supabase.from("patients").update(row).eq("id", id).select("id").single()
    : supabase.from("patients").insert({ ...row, organization_id: ctx.organization.id }).select("id").single();
  const { data, error } = await query;
  if (error || !data) return { ok: false, message: dbErrorMessage(error) };

  refresh(slug);
  return {
    ok: true,
    data: { id: data.id, name: v.name, phone: v.phone ?? "", email: v.email || undefined, birthDate: v.birthDate || undefined, notes: v.notes || undefined },
  };
}

export async function deletePatient(slug: string, id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Paciente inválido." };
  await requireMember(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_patient", { p_id: id });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh(slug);
  return { ok: true };
}
