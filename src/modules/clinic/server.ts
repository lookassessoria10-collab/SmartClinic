import "server-only";
import { cache } from "react";
import { addDays, endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { createSupabaseServerClient } from "@/server/supabase";
import type { MemberContext } from "@/server/auth";
import type { FinanceReport } from "@/modules/finance/model";
import type {
  Appointment, AppointmentEvent, Db, DayPeriod, ModuleKey, OpportunityKind, OpportunitySettings, OpportunitySnapshot, Proposal, Segment,
} from "@/prototype/types";

const ALL_KINDS: OpportunityKind[] = ["free_slots", "cancelled_slot", "follow_up_due", "proposal_stale", "no_show", "cancelled_appointment"];

/** Padrões da migração 0015, usados enquanto a clínica não tem a linha de configuração. */
export const DEFAULT_OPPORTUNITY_SETTINGS: OpportunitySettings = {
  enabledKinds: ALL_KINDS,
  proposalStaleDays: 7,
  slotHorizonDays: 14,
  followUpLeadDays: 14,
  priorityOverrides: {},
  excludedProfessionalIds: [],
  receptionSeesValues: false,
  professionalsSeeOwn: true,
};

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

  // Lista de espera, retornos e orçamentos (0014) e o resumo de Oportunidades (0015). A RLS filtra;
  // uma falha aqui não derruba a agenda nem os pacientes.
  // Módulos ligados (0016). Sem linhas (ou erro de leitura), tudo continua ligado: esconder por falha
  // tiraria funções que a clínica usa.
  const featureRows = await supabase.from("organization_features").select("feature, enabled").eq("organization_id", orgId);
  if (featureRows.error) console.error("[clínica] falha ao carregar módulos", featureRows.error.code, featureRows.error.message);
  const features: ModuleKey[] = featureRows.data?.length
    ? featureRows.data.filter((f) => f.enabled).map((f) => f.feature as ModuleKey)
    : ["schedule", "opportunities", "finance"];
  const hasFinance = features.includes("finance");
  const seesOpportunities =
    features.includes("opportunities") && (ctx.permissions.has("opportunities.read") || ctx.permissions.has("opportunities.read_own"));
  const seesReceipts = hasFinance && ["finance.read", "finance.write", "finance.read_own"].some((p) => ctx.permissions.has(p));
  const [waiting, followUps, proposals, items, oppSettings, feed, receiptRows, month] = await Promise.all([
    supabase
      .from("waiting_list")
      .select("id, patient_id, service_id, professional_id, weekdays, periods, earliest_date, latest_date, notes, status, appointment_id, created_at")
      .eq("organization_id", orgId)
      .eq("status", "waiting")
      .order("created_at")
      .limit(1000),
    supabase
      .from("follow_ups")
      .select("id, patient_id, professional_id, service_id, due_date, status, appointment_id, source_appointment_id, created_at")
      .eq("organization_id", orgId)
      .or(`status.in.(pending,scheduled),closed_at.gte.${subDays(now, 90).toISOString()}`)
      .order("due_date")
      .limit(2000),
    supabase
      .from("proposals")
      .select("id, patient_id, professional_id, title, status, valid_until, total_cents, last_activity_at, created_at")
      .eq("organization_id", orgId)
      .or(`status.eq.open,closed_at.gte.${subDays(now, 180).toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("proposal_items")
      .select("id, proposal_id, service_id, description, quantity, unit_price_cents, position")
      .eq("organization_id", orgId)
      .order("position")
      .limit(10000),
    supabase.from("opportunity_settings").select("*").eq("organization_id", orgId).maybeSingle(),
    seesOpportunities
      ? supabase.rpc("opportunities_feed", { p_org: orgId, p_limit: 3 })
      : Promise.resolve({ data: null, error: null }),
    seesReceipts
      ? supabase
          .from("financial_entries")
          .select("id, appointment_id, status")
          .eq("organization_id", orgId)
          .not("appointment_id", "is", null)
          .neq("status", "cancelled")
          .gte("due_date", format(subDays(now, 120), "yyyy-MM-dd"))
          .limit(5000)
      : Promise.resolve({ data: [] as { id: string; appointment_id: string | null; status: string }[], error: null }),
    hasFinance && ctx.permissions.has("finance.read")
      ? supabase.rpc("finance_report", { p_org: orgId, p_from: format(startOfMonth(now), "yyyy-MM-dd"), p_to: format(endOfMonth(now), "yyyy-MM-dd") })
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const [label, r] of [["lista de espera", waiting], ["retornos", followUps], ["orçamentos", proposals], ["itens", items], ["configurações", oppSettings], ["oportunidades", feed], ["recebimentos", receiptRows], ["financeiro do mês", month]] as const) {
    if (r.error) console.error(`[clínica] falha ao carregar ${label}`, r.error.code, r.error.message);
  }
  const itemsByProposal = new Map<string, Proposal["items"]>();
  for (const i of items.data ?? []) {
    itemsByProposal.set(i.proposal_id, [
      ...(itemsByProposal.get(i.proposal_id) ?? []),
      { id: i.id, serviceId: i.service_id, description: i.description, quantity: i.quantity, unitPriceCents: i.unit_price_cents },
    ]);
  }
  const s = oppSettings.data;

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
      features,
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
    waitingList: (waiting.data ?? []).map((w) => ({
      id: w.id,
      patientId: w.patient_id,
      serviceId: w.service_id,
      professionalId: w.professional_id,
      weekdays: w.weekdays,
      periods: w.periods as DayPeriod[] | null,
      earliestDate: w.earliest_date ?? undefined,
      latestDate: w.latest_date ?? undefined,
      notes: w.notes ?? undefined,
      status: w.status,
      appointmentId: w.appointment_id,
      createdAt: w.created_at,
    })),
    followUps: (followUps.data ?? []).map((f) => ({
      id: f.id,
      patientId: f.patient_id,
      professionalId: f.professional_id,
      serviceId: f.service_id,
      dueDate: f.due_date,
      status: f.status,
      appointmentId: f.appointment_id,
      sourceAppointmentId: f.source_appointment_id,
      createdAt: f.created_at,
    })),
    proposals: (proposals.data ?? []).map((p) => ({
      id: p.id,
      patientId: p.patient_id,
      professionalId: p.professional_id,
      title: p.title,
      status: p.status,
      validUntil: p.valid_until ?? undefined,
      totalCents: p.total_cents,
      lastActivityAt: p.last_activity_at,
      createdAt: p.created_at,
      items: itemsByProposal.get(p.id) ?? [],
    })),
    opportunitySettings: s
      ? {
          enabledKinds: s.enabled_kinds,
          proposalStaleDays: s.proposal_stale_days,
          slotHorizonDays: s.slot_horizon_days,
          followUpLeadDays: s.follow_up_lead_days,
          priorityOverrides: (s.priority_overrides ?? {}) as OpportunitySettings["priorityOverrides"],
          excludedProfessionalIds: s.excluded_professional_ids,
          receptionSeesValues: s.reception_sees_values,
          professionalsSeeOwn: s.professionals_see_own,
        }
      : DEFAULT_OPPORTUNITY_SETTINGS,
    opportunities: (feed.data as OpportunitySnapshot | null) ?? null,
    receipts: Object.fromEntries(
      (receiptRows.data ?? []).map((r) => [r.appointment_id!, { id: r.id, status: r.status === "paid" ? ("paid" as const) : ("pending" as const) }]),
    ),
    financeMonth: (month.data as FinanceReport | null) ?? null,
  };
});
