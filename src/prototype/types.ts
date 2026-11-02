// Tipos dos dados da clínica usados pelas telas. Espelham docs/03-modelo-de-dados.md de forma
// simplificada; desde a Fase 4 são preenchidos pelo banco (src/modules/clinic/server.ts).

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "declined"
  | "expired"
  | "cancelled"
  | "no_show"
  | "completed";

export type AppointmentOrigin = "staff" | "public";
export type Role = "manager" | "reception" | "professional";

export type Segment =
  | "medical_clinic"
  | "medical_office"
  | "dental_clinic"
  | "dental_office"
  | "aesthetic_clinic"
  | "aesthetic_office"
  | "multidisciplinary"
  | "other";

export type Need = "schedule" | "online_booking" | "finance" | "migrate";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  segment: Segment;
  phone: string;
  address: string;
  settings: {
    holdHours: number;
    minLeadHours: number;
    maxDaysAhead: number;
    slotStepMin: number;
  };
  features: string[];
  onboarding?: { segment: Segment; size: string; services: string[]; need: Need };
}

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  color: number; // 1..8 → --agenda-N
  acceptsPublic: boolean;
  active: boolean;
  /** Conta da equipe ligada a este profissional (null = não usa o sistema). */
  userId: string | null;
  councilType?: string;
  councilNumber?: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  durationMin: number;
  bufferAfterMin: number;
  priceCents: number | null;
  isPublic: boolean;
  showPrice: boolean;
  active: boolean;
  professionalIds: string[];
}

export interface Patient {
  id: string;
  name: string;
  phone: string; // E.164 ou "" (sem telefone)
  email?: string;
  birthDate?: string;
  notes?: string;
}

export interface AvailabilityRule {
  professionalId: string;
  weekday: number; // 0 = domingo
  start: string; // "08:00"
  end: string;
}

export interface ScheduleBlock {
  id: string;
  professionalId: string | null; // null = clínica inteira
  kind: "break" | "time_off" | "vacation" | "holiday" | "other";
  startsAt: string;
  endsAt: string;
  reason: string;
}

export interface Appointment {
  id: string;
  professionalId: string;
  serviceId: string;
  patientId: string | null;
  startsAt: string; // ISO (UTC)
  endsAt: string; // inclui buffer pós-atendimento
  status: AppointmentStatus;
  origin: AppointmentOrigin;
  holdExpiresAt?: string;
  notes?: string;
  createdAt: string;
  /** Só a ocupação é conhecida (agenda de outro profissional, ADR-015): sem serviço nem paciente. */
  hidden?: boolean;
}

export interface BookingRequest {
  appointmentId: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  /** No banco real guardamos apenas o hash (RN-35). No protótipo fica em claro. */
  token: string;
  consentAt: string;
  declineReason?: string;
}

export interface AppointmentEvent {
  appointmentId: string;
  from: AppointmentStatus | null;
  to: AppointmentStatus;
  at: string;
  actor: string;
  reason?: string;
}

export interface Viewer {
  role: Role;
  name: string;
  professionalId: string | null;
}

export interface Db {
  version: number;
  org: Organization;
  professionals: Professional[];
  services: Service[];
  patients: Patient[];
  availability: AvailabilityRule[];
  blocks: ScheduleBlock[];
  appointments: Appointment[];
  requests: BookingRequest[];
  events: AppointmentEvent[];
  viewer: Viewer;
  /* Módulo Oportunidades (migrações 0014–0015). */
  waitingList: WaitingEntry[];
  followUps: FollowUp[];
  proposals: Proposal[];
  opportunitySettings: OpportunitySettings;
  /** Resumo para o Início; null se o módulo não pôde ser lido (o resto da tela segue). */
  opportunities: OpportunitySnapshot | null;
}

export type DayPeriod = "morning" | "afternoon" | "evening";

export interface WaitingEntry {
  id: string;
  patientId: string;
  serviceId: string | null;
  professionalId: string | null;
  weekdays: number[] | null;
  periods: DayPeriod[] | null;
  earliestDate?: string; // yyyy-MM-dd
  latestDate?: string;
  notes?: string;
  status: "waiting" | "booked" | "removed";
  appointmentId: string | null;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  patientId: string;
  professionalId: string;
  serviceId: string | null;
  dueDate: string; // yyyy-MM-dd
  status: "pending" | "scheduled" | "done" | "cancelled";
  appointmentId: string | null;
  sourceAppointmentId: string | null;
  createdAt: string;
}

export interface ProposalItem {
  id: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Proposal {
  id: string;
  patientId: string;
  professionalId: string | null;
  title: string;
  status: "open" | "accepted" | "declined" | "cancelled" | "expired";
  validUntil?: string;
  totalCents: number;
  lastActivityAt: string;
  createdAt: string;
  items: ProposalItem[];
}

export type OpportunityKind = "free_slots" | "cancelled_slot" | "follow_up_due" | "proposal_stale" | "no_show" | "cancelled_appointment";
export type OpportunityStatus = "new" | "in_progress" | "resolved" | "dismissed" | "expired";
export type OpportunityCategory = "agenda" | "pacientes" | "financeiro";

export interface OpportunitySettings {
  enabledKinds: OpportunityKind[];
  proposalStaleDays: number;
  slotHorizonDays: number;
  followUpLeadDays: number;
  priorityOverrides: Partial<Record<OpportunityKind, 1 | 2 | 3>>;
  excludedProfessionalIds: string[];
  receptionSeesValues: boolean;
  professionalsSeeOwn: boolean;
}

/** Como o valor foi calculado (docs/17 §6). Preços somem quando a pessoa não pode ver valores. */
export interface ValueBasis {
  method: "free_slots" | "cancelled_slot" | "follow_up" | "proposal" | "none";
  slots?: number;
  free_minutes?: number;
  slot_minutes?: number;
  service_id?: string | null;
  service_name?: string | null;
  unit_price_cents?: number | null;
  reference?: "most_booked" | "shortest";
  total_cents?: number;
  items?: number;
  due_date?: string;
  valid_until?: string | null;
  last_activity_at?: string;
}

export interface OpportunityItem {
  id: string;
  kind: OpportunityKind;
  category: OpportunityCategory;
  status: OpportunityStatus;
  priority: 1 | 2 | 3;
  professional_id: string | null;
  patient_id: string | null;
  service_id: string | null;
  appointment_id: string | null;
  follow_up_id: string | null;
  proposal_id: string | null;
  window_start: string | null;
  window_end: string | null;
  slot_count: number | null;
  value_cents: number | null;
  value_visible: boolean;
  basis: ValueBasis | null;
  assigned_to: string | null;
  detected_at: string;
  expires_at: string | null;
  resolved_at: string | null;
  resolution: "auto" | "manual" | null;
  dismiss_reason: string | null;
  matches: number | null;
  last_action_at: string | null;
}

export interface OpportunitySummary {
  at_risk_cents: number | null;
  at_risk_unpriced: number;
  at_risk_hidden: number;
  proposals_cents: number | null;
  free_slots: number;
  open: number;
  high: number;
  resolved: number;
  agenda: number;
  pacientes: number;
  financeiro: number;
}

/** Resposta de `opportunities_feed` (migração 0015). */
export interface OpportunitySnapshot {
  refreshed_at: string | null;
  horizon_days: number;
  values_visible: boolean;
  summary: OpportunitySummary;
  total: number;
  items: OpportunityItem[];
}

export interface OpportunityAction {
  kind: "detected" | "reopened" | "contact" | "assigned" | "status" | "booked" | "resolved_auto" | "expired";
  from: OpportunityStatus | null;
  to: OpportunityStatus | null;
  outcome: ContactOutcome | null;
  note: string | null;
  at: string;
  appointment_id: string | null;
  actor: string | null;
  assigned: string | null;
}

export type ContactOutcome = "no_answer" | "call_back" | "scheduled" | "not_now" | "other";

/** Resposta de `opportunity_detail`. */
export interface OpportunityDetail {
  id: string;
  value_cents: number | null;
  basis: ValueBasis | null;
  free_ranges: { start: string; end: string }[];
  actions: OpportunityAction[];
  matches: { entry_id: string; patient_id: string; service_id: string; starts_at: string }[];
}
