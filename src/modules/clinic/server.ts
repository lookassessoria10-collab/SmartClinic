import "server-only";
import { cache } from "react";
import { addDays, subDays } from "date-fns";
import { createSupabaseServerClient } from "@/server/supabase";
import type { MemberContext } from "@/server/auth";
import type { Appointment, AppointmentEvent, Db, Segment } from "@/prototype/types";

/**
 * Dados da clínica para as telas de agenda, pacientes e Início, lidos COM A SESSÃO da pessoa:
 * a RLS decide o que entra (profissional recebe só os próprios pacientes e atendimentos; a
 * agenda dos outros chega só como ocupação, pela função schedule_busy — ADR-015).
 *
 * Janela: 90 dias para trás e 240 para frente. Suficiente para a operação diária e para os
 * testes; a Fase 5b troca por carregamento por período, se o volume pedir.
 */
export const loadClinicDb = cache(async (ctx: MemberContext, viewerName: string): Promise<Db> => {
  const supabase = await createSupabaseServerClient();
  const orgId = ctx.organization.id;
  const now = new Date();
  const from = subDays(now, 90).toISOString();
  const to = addDays(now, 240).toISOString();
  const seesBusy = ctx.permissions.has("schedule.view_all");

  const [org, pros, svcs, links, patients, rules, blocks, appts, busy, events] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, segment, phone").eq("id", orgId).single(),
    supabase
      .from("professionals")
      .select("id, display_name, specialty, color, accepts_public_booking, active, user_id, council_type, council_number")
      .eq("organization_id", orgId)
      .order("display_name"),
    supabase
      .from("services")
      .select("id, name, category, duration_min, buffer_after_min, price_cents, is_public, show_price_publicly, active")
      .eq("organization_id", orgId)
      .order("name"),
    supabase.from("professional_services").select("professional_id, service_id").eq("organization_id", orgId),
    supabase
      .from("patients")
      .select("id, full_name, phone_e164, email, birth_date, admin_notes")
      .eq("organization_id", orgId)
      .order("full_name")
      .limit(5000),
    supabase.from("availability_rules").select("professional_id, weekday, start_time, end_time").eq("organization_id", orgId),
    supabase
      .from("schedule_blocks")
      .select("id, professional_id, kind, starts_at, ends_at, reason")
      .eq("organization_id", orgId)
      .lt("starts_at", to)
      .gt("ends_at", from),
    supabase
      .from("appointments")
      .select("id, professional_id, service_id, patient_id, starts_at, ends_at, status, origin, hold_expires_at, admin_notes, created_at")
      .eq("organization_id", orgId)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at"),
    seesBusy
      ? supabase.rpc("schedule_busy", { p_org: orgId, p_from: from, p_to: to })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("appointment_events")
      .select("appointment_id, from_status, to_status, actor_user_id, reason, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", subDays(now, 120).toISOString())
      .order("created_at"),
  ]);

  for (const r of [org, pros, svcs, links, patients, rules, blocks, appts, busy, events]) {
    if (r.error) throw new Error(`Falha ao carregar dados da clínica: ${r.error.message}`);
  }

  const prosByService = new Map<string, string[]>();
  for (const l of links.data ?? []) {
    prosByService.set(l.service_id, [...(prosByService.get(l.service_id) ?? []), l.professional_id]);
  }

  const appointments: Appointment[] = (appts.data ?? []).map((a) => ({
    id: a.id,
    professionalId: a.professional_id,
    serviceId: a.service_id,
    patientId: a.patient_id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    status: a.status,
    origin: a.origin === "public" ? "public" : "staff",
    holdExpiresAt: a.hold_expires_at ?? undefined,
    notes: a.admin_notes ?? undefined,
    createdAt: a.created_at,
  }));
  const known = new Set(appointments.map((a) => a.id));
  for (const b of busy.data ?? []) {
    if (known.has(b.id)) continue;
    appointments.push({
      id: b.id,
      professionalId: b.professional_id,
      serviceId: "",
      patientId: null,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      status: b.status,
      origin: "staff",
      createdAt: b.starts_at,
      hidden: true,
    });
  }

  // Nomes de quem mexeu em cada agendamento (perfis da mesma clínica são visíveis pela RLS).
  const actorIds = [...new Set((events.data ?? []).map((e) => e.actor_user_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", actorIds);
    for (const p of data ?? []) names.set(p.user_id, p.full_name);
  }
  const history: AppointmentEvent[] = (events.data ?? []).map((e) => ({
    appointmentId: e.appointment_id,
    from: e.from_status,
    to: e.to_status,
    at: e.created_at,
    actor: e.actor_user_id ? (names.get(e.actor_user_id) ?? "Equipe") : "Sistema",
    reason: e.reason ?? undefined,
  }));

  const professionals = (pros.data ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
    specialty: p.specialty ?? "",
    color: p.color,
    acceptsPublic: p.accepts_public_booking,
    active: p.active,
    userId: p.user_id,
    councilType: p.council_type ?? undefined,
    councilNumber: p.council_number ?? undefined,
  }));

  return {
    version: 1,
    org: {
      id: org.data!.id,
      name: org.data!.name,
      slug: org.data!.slug,
      segment: org.data!.segment as Segment,
      phone: org.data!.phone ?? "",
      address: "",
      settings: { holdHours: 24, minLeadHours: 2, maxDaysAhead: 60, slotStepMin: 30 },
      features: ["schedule"],
    },
    professionals,
    services: (svcs.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category ?? "",
      durationMin: s.duration_min,
      bufferAfterMin: s.buffer_after_min,
      priceCents: s.price_cents,
      isPublic: s.is_public,
      showPrice: s.show_price_publicly,
      active: s.active,
      professionalIds: prosByService.get(s.id) ?? [],
    })),
    patients: (patients.data ?? []).map((p) => ({
      id: p.id,
      name: p.full_name,
      phone: p.phone_e164 ?? "",
      email: p.email ?? undefined,
      birthDate: p.birth_date ?? undefined,
      notes: p.admin_notes ?? undefined,
    })),
    availability: (rules.data ?? []).map((r) => ({
      professionalId: r.professional_id,
      weekday: r.weekday,
      start: r.start_time.slice(0, 5),
      end: r.end_time.slice(0, 5),
    })),
    blocks: (blocks.data ?? []).map((b) => ({
      id: b.id,
      professionalId: b.professional_id,
      kind: b.kind,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      reason: b.reason ?? "",
    })),
    appointments,
    requests: [],
    events: history,
    viewer: {
      role: ctx.role,
      name: viewerName,
      professionalId: professionals.find((p) => p.userId === ctx.user.id)?.id ?? null,
    },
  };
});
