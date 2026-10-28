/**
 * Dados 100% fictícios (docs/09 S12). Telefones na faixa +55 11 90000-0xxx, e-mails em
 * domínio reservado .test. Os agendamentos são gerados em torno da data atual para o
 * protótipo sempre parecer "vivo".
 */
import { addDays, addMinutes, startOfDay, startOfWeek } from "date-fns";
import { freeSlots, holdExpiry } from "@/modules/availability/rules";
import type { Appointment, AvailabilityRule, BookingRequest, Db, Patient, Professional, Service } from "./types";

export const DB_VERSION = 4;

const professionals: Professional[] = [
  { id: "p1", name: "Dra. Ana Ribeiro", specialty: "Dentista — clínica geral", color: 1, acceptsPublic: true },
  { id: "p2", name: "Dr. Marcos Lima", specialty: "Dentista — endodontia", color: 6, acceptsPublic: true },
  { id: "p3", name: "Carla Souza", specialty: "Esteticista", color: 5, acceptsPublic: true },
];

const services: Service[] = [
  { id: "s1", name: "Avaliação odontológica", category: "Consulta", durationMin: 30, bufferAfterMin: 0, priceCents: 15000, isPublic: true, showPrice: true, professionalIds: ["p1", "p2"] },
  { id: "s2", name: "Limpeza", category: "Procedimento", durationMin: 45, bufferAfterMin: 15, priceCents: 22000, isPublic: true, showPrice: true, professionalIds: ["p1", "p2"] },
  { id: "s3", name: "Restauração", category: "Procedimento", durationMin: 60, bufferAfterMin: 0, priceCents: 35000, isPublic: false, showPrice: false, professionalIds: ["p1", "p2"] },
  { id: "s4", name: "Tratamento de canal", category: "Procedimento", durationMin: 90, bufferAfterMin: 0, priceCents: 120000, isPublic: false, showPrice: false, professionalIds: ["p2"] },
  { id: "s5", name: "Retorno", category: "Retorno", durationMin: 20, bufferAfterMin: 0, priceCents: null, isPublic: false, showPrice: false, professionalIds: ["p1", "p2"] },
  { id: "s6", name: "Limpeza de pele", category: "Sessão", durationMin: 60, bufferAfterMin: 0, priceCents: 18000, isPublic: true, showPrice: true, professionalIds: ["p3"] },
  { id: "s7", name: "Sessão de laser", category: "Sessão", durationMin: 30, bufferAfterMin: 0, priceCents: 25000, isPublic: true, showPrice: false, professionalIds: ["p3"] },
];

const names = [
  "Mariana Alves", "João Pereira", "Beatriz Santos", "Rafael Oliveira", "Fernanda Costa",
  "Lucas Martins", "Juliana Rocha", "Pedro Carvalho", "Camila Fernandes", "Gustavo Almeida",
  "Larissa Gomes", "Thiago Barbosa", "Patrícia Moura", "André Nunes", "Helena Duarte",
  "Rodrigo Teixeira", "Sofia Mendes", "Eduardo Freitas",
];

const patients: Patient[] = names.map((name, i) => ({
  id: `pt${i + 1}`,
  name,
  phone: `+551190000${String(1000 + i).padStart(4, "0")}`,
  email: i % 3 === 0 ? `${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}@exemplo.test` : undefined,
  birthDate: i % 2 === 0 ? `19${70 + i}-0${(i % 9) + 1}-1${i % 9}` : undefined,
  notes: i === 2 ? "Prefere horários pela manhã." : undefined,
}));

const weekdays = [1, 2, 3, 4, 5];
const availability: AvailabilityRule[] = [
  ...weekdays.flatMap((d) => [
    { professionalId: "p1", weekday: d, start: "08:00", end: "12:00" },
    { professionalId: "p1", weekday: d, start: "13:00", end: "17:00" },
  ]),
  ...[1, 3, 5].flatMap((d) => [
    { professionalId: "p2", weekday: d, start: "09:00", end: "12:00" },
    { professionalId: "p2", weekday: d, start: "13:00", end: "18:00" },
  ]),
  ...[2, 3, 4, 5, 6].flatMap((d) => [
    { professionalId: "p3", weekday: d, start: "09:00", end: "12:00" },
    { professionalId: "p3", weekday: d, start: "13:00", end: d === 6 ? "15:00" : "18:00" },
  ]),
];

/** Gerador pseudoaleatório determinístico (mesma agenda a cada restauração no mesmo dia). */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function createSeed(now = new Date()): Db {
  const rand = rng(+startOfDay(now) / 86400000);
  const appointments: Appointment[] = [];
  const requests: BookingRequest[] = [];
  let seq = 1;

  const weekStart = startOfWeek(addDays(now, -7), { weekStartsOn: 1 });
  for (let d = 0; d < 28; d++) {
    const day = addDays(weekStart, d);
    for (const p of professionals) {
      const mine = services.filter((s) => s.professionalIds.includes(p.id));
      // Ocupação ~55%: tenta alguns encaixes por dia.
      for (let k = 0; k < 9; k++) {
        const svc = mine[Math.floor(rand() * mine.length)];
        const slots = freeSlots({
          day, professionalId: p.id, durationMin: svc.durationMin, bufferAfterMin: svc.bufferAfterMin,
          // Na vida real todo atendimento passado foi "confirmado" antes: nenhum pode se sobrepor.
          stepMin: 30, rules: availability, blocks: [], appointments: appointments.filter((a) => a.status !== "cancelled").map((a) => ({ ...a, status: "confirmed" as const })),
        });
        if (!slots.length) break;
        if (rand() < 0.35) continue;
        const start = slots[Math.floor(rand() * slots.length)];
        const end = addMinutes(start, svc.durationMin + svc.bufferAfterMin);
        const past = end < now;
        const r = rand();
        const status: Appointment["status"] = past
          ? r < 0.85 ? "completed" : r < 0.93 ? "no_show" : "cancelled"
          : r < 0.94 ? "confirmed" : "cancelled";
        appointments.push({
          id: `a${seq++}`,
          professionalId: p.id,
          serviceId: svc.id,
          patientId: patients[Math.floor(rand() * patients.length)].id,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          status,
          origin: rand() < 0.2 ? "public" : "staff",
          createdAt: addDays(start, -3).toISOString(),
        });
      }
    }
  }

  // Solicitações pendentes da página pública (uma delas com telefone de paciente existente).
  const pending = [
    { name: "Mariana A.", phone: patients[0].phone, email: undefined, svc: "s2", prof: "p1", inDays: 1, ageMin: 20 * 60 },
    { name: "Vinícius Prado", phone: "+5511900009001", email: "vinicius@exemplo.test", svc: "s6", prof: "p3", inDays: 2, ageMin: 90 },
    { name: "Clara Monteiro", phone: "+5511900009002", email: undefined, svc: "s1", prof: "p2", inDays: 3, ageMin: 15 },
  ];
  for (const r of pending) {
    const svc = services.find((s) => s.id === r.svc)!;
    let day = addDays(startOfDay(now), r.inDays);
    let slots: Date[] = [];
    for (let i = 0; i < 7 && !slots.length; i++, day = addDays(day, 1)) {
      slots = freeSlots({ day, professionalId: r.prof, durationMin: svc.durationMin, bufferAfterMin: svc.bufferAfterMin, stepMin: 30, rules: availability, blocks: [], appointments });
    }
    if (!slots.length) continue;
    const start = slots[Math.floor(slots.length / 2)];
    const created = addMinutes(now, -r.ageMin);
    const id = `a${seq++}`;
    appointments.push({
      id, professionalId: r.prof, serviceId: svc.id, patientId: null,
      startsAt: start.toISOString(), endsAt: addMinutes(start, svc.durationMin + svc.bufferAfterMin).toISOString(),
      status: "requested", origin: "public",
      holdExpiresAt: holdExpiry(created, start, 24, 2).toISOString(),
      createdAt: created.toISOString(),
    });
    requests.push({ appointmentId: id, name: r.name, phone: r.phone, email: r.email, token: `demo-${id}`, consentAt: created.toISOString() });
  }

  return {
    version: DB_VERSION,
    org: {
      id: "org1",
      name: "Clínica Aurora",
      slug: "clinica-aurora",
      segment: "multidisciplinary",
      phone: "+551130000000",
      address: "Rua Exemplo, 100 — São Paulo, SP",
      settings: { holdHours: 24, minLeadHours: 2, maxDaysAhead: 60, slotStepMin: 30 },
      features: ["schedule", "online_booking", "finance"],
    },
    professionals,
    services,
    patients,
    availability,
    blocks: [],
    appointments,
    requests,
    events: [],
    viewer: { role: "reception", name: "Bruno Costa", professionalId: null },
  };
}

/** Perfis para o seletor "Visualizar como" do protótipo. */
export const VIEWERS = {
  manager: { role: "manager", name: "Dra. Ana Ribeiro", professionalId: "p1" },
  reception: { role: "reception", name: "Bruno Costa", professionalId: null },
  professional: { role: "professional", name: "Carla Souza", professionalId: "p3" },
} as const;

/** Sugestões do onboarding por tipo de estabelecimento (docs/05 F1). */
export const SEGMENT_SUGGESTIONS: Record<string, { name: string; durationMin: number; category: string }[]> = {
  dental: [
    { name: "Avaliação", durationMin: 30, category: "Consulta" },
    { name: "Limpeza", durationMin: 45, category: "Procedimento" },
    { name: "Restauração", durationMin: 60, category: "Procedimento" },
    { name: "Clareamento", durationMin: 60, category: "Procedimento" },
    { name: "Retorno", durationMin: 20, category: "Retorno" },
  ],
  aesthetic: [
    { name: "Avaliação estética", durationMin: 30, category: "Consulta" },
    { name: "Limpeza de pele", durationMin: 60, category: "Sessão" },
    { name: "Sessão de laser", durationMin: 30, category: "Sessão" },
    { name: "Drenagem linfática", durationMin: 50, category: "Sessão" },
    { name: "Peeling", durationMin: 45, category: "Procedimento" },
  ],
  medical: [
    { name: "Consulta", durationMin: 30, category: "Consulta" },
    { name: "Retorno", durationMin: 20, category: "Retorno" },
    { name: "Teleconsulta", durationMin: 30, category: "Consulta" },
    { name: "Avaliação de exames", durationMin: 20, category: "Consulta" },
  ],
  multidisciplinary: [
    { name: "Consulta", durationMin: 30, category: "Consulta" },
    { name: "Avaliação", durationMin: 40, category: "Consulta" },
    { name: "Sessão", durationMin: 50, category: "Sessão" },
    { name: "Retorno", durationMin: 20, category: "Retorno" },
  ],
};

export function segmentFamily(segment: string) {
  if (segment.startsWith("dental")) return "dental";
  if (segment.startsWith("aesthetic")) return "aesthetic";
  if (segment.startsWith("medical")) return "medical";
  return "multidisciplinary";
}
