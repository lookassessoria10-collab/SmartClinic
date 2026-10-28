"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase";
import { createSupabaseAdminClient } from "@/server/admin/supabase-admin";
import { ForbiddenError, ReadOnlyError, getCurrentUser, requireMember, requirePermission } from "@/server/auth";
import { fieldErrors, passwordSchema, type FieldErrors } from "@/modules/auth/schemas";
import { LAST_CLINIC_COOKIE } from "@/modules/auth/constants";
import { slugProblem } from "@/modules/organizations/schemas";
import { teamErrorMessage } from "./errors";
import { invitationLink, sendAccessLink, sendInvitationEmail } from "./invitation-email";

export interface ActionState {
  ok?: boolean;
  message?: string;
  fields?: FieldErrors;
  values?: Record<string, string>;
}

const roleSchema = z.enum(["manager", "reception", "professional"], { message: "Escolha um papel." });

/** Converte as falhas de permissão do servidor na mesma linguagem das do banco. */
function guardError(e: unknown): ActionState {
  if (e instanceof ForbiddenError) return { message: "Você não tem permissão para esta ação." };
  if (e instanceof ReadOnlyError) return { message: teamErrorMessage({ hint: "org_read_only" }) };
  throw e;
}

async function managerContext(slug: string, permission: "members.manage" | "org.settings") {
  const ctx = await requireMember(slug);
  requirePermission(ctx, permission, { write: true });
  return ctx;
}

const refresh = (slug: string) => revalidatePath(`/c/${slug}`, "layout");

/* ---------- Convites ---------- */

export async function inviteMember(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { email: String(formData.get("email") ?? ""), role: String(formData.get("role") ?? "") };
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")), role: roleSchema })
    .safeParse(values);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  let ctx;
  try {
    ctx = await managerContext(slug, "members.manage");
  } catch (e) {
    return guardError(e);
  }

  const supabase = await createSupabaseServerClient();
  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_org: ctx.organization.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || !token) return { message: teamErrorMessage(error), values };

  const sent = await sendInvitationEmail(parsed.data.email, token);
  refresh(slug);
  if (!sent.ok) {
    return { ok: true, message: `Convite criado, mas o e-mail não pôde ser enviado agora. Use "Reenviar" em instantes.` };
  }
  return { ok: true, message: `Convite enviado para ${parsed.data.email}.` };
}

/** Reenviar = novo código (o anterior deixa de valer) + novo e-mail. */
export async function resendInvitation(slug: string, invitationId: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await managerContext(slug, "members.manage");
  } catch (e) {
    return guardError(e);
  }
  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("email, role")
    .eq("id", invitationId)
    .eq("organization_id", ctx.organization.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();
  if (!inv) return { message: "Este convite não está mais pendente." };

  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_org: ctx.organization.id,
    p_email: inv.email,
    p_role: inv.role,
  });
  if (error || !token) return { message: teamErrorMessage(error) };
  const sent = await sendInvitationEmail(inv.email, token);
  refresh(slug);
  return sent.ok ? { ok: true, message: `Convite reenviado para ${inv.email}.` } : { message: "Não foi possível enviar o e-mail agora." };
}

export async function cancelInvitation(slug: string, invitationId: string): Promise<ActionState> {
  try {
    await managerContext(slug, "members.manage");
  } catch (e) {
    return guardError(e);
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation: invitationId });
  if (error) return { message: teamErrorMessage(error) };
  refresh(slug);
  return { ok: true, message: "Convite cancelado. O link enviado deixou de valer." };
}

/* ---------- Membros ---------- */

export async function changeMemberRole(slug: string, membershipId: string, role: string): Promise<ActionState> {
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { message: "Papel inválido." };
  try {
    await managerContext(slug, "members.manage");
  } catch (e) {
    return guardError(e);
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("change_member_role", { p_membership: membershipId, p_role: parsed.data });
  if (error) return { message: teamErrorMessage(error) };
  refresh(slug);
  return { ok: true, message: "Papel atualizado. Vale a partir da próxima ação da pessoa." };
}

export async function setMemberStatus(slug: string, membershipId: string, status: "active" | "disabled"): Promise<ActionState> {
  if (status !== "active" && status !== "disabled") return { message: "Situação inválida." };
  try {
    await managerContext(slug, "members.manage");
  } catch (e) {
    return guardError(e);
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_member_status", { p_membership: membershipId, p_status: status });
  if (error) return { message: teamErrorMessage(error) };
  refresh(slug);
  return {
    ok: true,
    message: status === "disabled" ? "Acesso desativado. A pessoa já não consegue abrir a clínica." : "Acesso reativado.",
  };
}

/* ---------- Clínica ---------- */

export async function updateClinic(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { name: String(formData.get("name") ?? ""), phone: String(formData.get("phone") ?? "") };
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Informe o nome da clínica.").max(120, "Nome longo demais."),
      phone: z.string().trim().max(30, "Telefone longo demais."),
    })
    .safeParse(values);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  let ctx;
  try {
    ctx = await managerContext(slug, "org.settings");
  } catch (e) {
    return guardError(e);
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name: parsed.data.name, phone: parsed.data.phone || null })
    .eq("id", ctx.organization.id);
  if (error) return { message: teamErrorMessage(error), values };
  refresh(slug);
  return { ok: true, message: "Dados da clínica salvos.", values };
}

export async function changeClinicSlug(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const next = String(formData.get("slug") ?? "").trim().toLowerCase();
  const problem = slugProblem(next);
  if (problem) return { fields: { slug: problem }, values: { slug: next } };

  let ctx;
  try {
    ctx = await managerContext(slug, "org.settings");
  } catch (e) {
    return guardError(e);
  }
  if (next === ctx.organization.slug) return { message: "Este já é o endereço atual.", values: { slug: next } };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("change_slug", { p_org: ctx.organization.id, p_slug: next });
  if (error) {
    return error.hint === "slug_unavailable"
      ? { fields: { slug: teamErrorMessage(error) }, values: { slug: next } }
      : { message: teamErrorMessage(error), values: { slug: next } };
  }
  (await cookies()).set(LAST_CLINIC_COOKIE, next, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect(`/c/${next}/gestao/clinica?salvo=1`);
}

/* ---------- Aceite do convite (quem foi convidado) ---------- */

export async function acceptInvitation(token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { message: "Entre na sua conta para aceitar o convite." };
  const supabase = await createSupabaseServerClient();

  const { data: invitation } = await supabase.rpc("get_my_invitation", { p_token: token }).maybeSingle();
  if (!invitation) return { message: teamErrorMessage({ hint: "invitation_invalid" }) };

  // Conta criada pelo convite: ainda não tem senha nem nome definidos pela própria pessoa.
  if (invitation.needs_password) {
    const values = { fullName: String(formData.get("fullName") ?? "") };
    const parsed = z
      .object({ fullName: z.string().trim().min(3, "Informe seu nome completo.").max(120), password: passwordSchema })
      .safeParse({ fullName: values.fullName, password: String(formData.get("password") ?? "") });
    if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

    const { error: pwError } = await supabase.auth.updateUser({
      password: parsed.data.password,
      data: { full_name: parsed.data.fullName, needs_password: false },
    });
    if (pwError) {
      return pwError.code === "weak_password"
        ? { fields: { password: "Escolha uma senha mais forte." }, values }
        : { message: "Não foi possível salvar a senha. Tente de novo.", values };
    }
    await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("user_id", user.id);
  }

  const { data: orgId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !orgId) return { message: teamErrorMessage(error) };

  const { data: org } = await supabase.from("organizations").select("slug").eq("id", orgId).single();
  (await cookies()).set(LAST_CLINIC_COOKIE, org!.slug, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect(`/c/${org!.slug}/inicio`);
}

/**
 * Pedir um novo link de acesso para um convite ainda válido (o link do e-mail vale 1 hora,
 * o convite vale 7 dias). Vai sempre para o e-mail do convite — nunca para outro endereço —
 * e a resposta é a mesma exista ou não o convite.
 */
export async function requestInvitationLink(token: string): Promise<ActionState> {
  const generic: ActionState = { ok: true, message: "Se este convite ainda for válido, enviamos um novo link para o e-mail convidado." };
  if (!/^[a-f0-9]{64}$/.test(token)) return generic;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.rpc("invitation_email_for_token", { p_token: token });
  if (data) await sendAccessLink(data, invitationLink(token));
  return generic;
}
