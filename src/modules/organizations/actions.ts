"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase";
import { requireUser } from "@/server/auth";
import { fieldErrors, type FieldErrors } from "@/modules/auth/schemas";
import { LAST_CLINIC_COOKIE } from "@/modules/auth/constants";
import { onboardingSchema, slugProblem } from "./schemas";

export interface OnboardingResult {
  message?: string;
  fields?: FieldErrors;
}

/** Verificação ao vivo do endereço no onboarding (o banco decide de verdade ao criar). */
export async function checkSlug(slug: string): Promise<{ available: boolean; message?: string }> {
  await requireUser();
  const value = slug.trim().toLowerCase();
  const problem = slugProblem(value);
  if (problem) return { available: false, message: problem };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("slug_available", { p_slug: value });
  if (error) return { available: false, message: "Não foi possível verificar agora." };
  return data ? { available: true } : { available: false, message: "Este endereço já está em uso." };
}

/**
 * Cria a clínica numa transação única (função create_organization, migração 0007):
 * organização + unidade padrão + gestor + profissional (se atende) + respostas do onboarding.
 */
export async function createClinic(input: unknown): Promise<OnboardingResult> {
  await requireUser("/onboarding");
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), message: "Revise os campos destacados." };
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: v.name,
    p_slug: v.slug,
    p_segment: v.segment,
    // Serviços sugeridos ficam guardados aqui até a Fase 4 (cadastro de serviços).
    p_onboarding: { size: v.size, services: v.services, need: v.need },
    p_attends: v.attends,
    p_specialty: v.attends ? v.specialty || undefined : undefined,
  });

  if (error) {
    if (error.hint === "slug_unavailable") return { fields: { slug: "Este endereço já está em uso ou não é permitido." } };
    if (error.hint === "org_limit") return { message: "Você atingiu o limite de clínicas criadas por conta." };
    if (error.code === "42501") return { message: "Confirme seu e-mail antes de criar a clínica." };
    console.error("[onboarding] create_organization", error.code, error.message);
    return { message: "Não foi possível criar a clínica agora. Tente de novo em instantes." };
  }

  (await cookies()).set(LAST_CLINIC_COOKIE, v.slug, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect(`/c/${v.slug}/inicio`);
}
