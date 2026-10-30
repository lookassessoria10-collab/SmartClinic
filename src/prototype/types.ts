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
}
