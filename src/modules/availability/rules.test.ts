import { describe, expect, it } from "vitest";
import { canTransition, freeSlots, hasConflict, holdExpiry, overlaps } from "./rules";
import type { Appointment, AvailabilityRule } from "@/prototype/types";

// Segunda-feira, 2 de novembro de 2026 (horário local).
const monday = new Date(2026, 10, 2);
const at = (h: number, m = 0) => new Date(2026, 10, 2, h, m);

const rules: AvailabilityRule[] = [
  { professionalId: "p1", weekday: 1, start: "08:00", end: "12:00" },
  { professionalId: "p1", weekday: 1, start: "13:00", end: "15:00" },
];

const appt = (id: string, start: Date, end: Date, status: Appointment["status"] = "confirmed"): Appointment => ({
  id,
  professionalId: "p1",
  serviceId: "s1",
  patientId: null,
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
  status,
  origin: "staff",
  createdAt: start.toISOString(),
});

const base = { day: monday, professionalId: "p1", durationMin: 30, bufferAfterMin: 0, stepMin: 30, rules, blocks: [] };

describe("overlaps", () => {
  it("considera encostar como livre", () => {
    expect(overlaps(at(9), at(10), at(10), at(11))).toBe(false);
    expect(overlaps(at(9), at(10, 1), at(10), at(11))).toBe(true);
  });
});

describe("freeSlots", () => {
  it("respeita janelas e intervalo de almoço", () => {
    const slots = freeSlots({ ...base, appointments: [] });
    expect(slots.map((d) => d.getHours() + d.getMinutes() / 60)).toEqual([8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 13, 13.5, 14, 14.5]);
  });

  it("desconta agendamentos confirmados e solicitações pendentes", () => {
    const slots = freeSlots({
      ...base,
      appointments: [appt("a", at(8), at(9)), appt("b", at(13), at(13, 30), "requested")],
    });
    expect(slots.some((s) => +s === +at(8))).toBe(false);
    expect(slots.some((s) => +s === +at(8, 30))).toBe(false);
    expect(slots.some((s) => +s === +at(13))).toBe(false);
    expect(slots.some((s) => +s === +at(9))).toBe(true);
  });

  it("ignora cancelados e expirados", () => {
    const slots = freeSlots({ ...base, appointments: [appt("a", at(8), at(9), "cancelled"), appt("b", at(9), at(10), "expired")] });
    expect(slots[0]).toEqual(at(8));
  });

  it("exige que duração + buffer caibam inteiros", () => {
    const slots = freeSlots({ ...base, durationMin: 50, bufferAfterMin: 10, appointments: [] });
    expect(slots.some((s) => +s === +at(11, 30))).toBe(false);
    expect(slots.some((s) => +s === +at(11))).toBe(true);
  });

  it("aplica bloqueios da clínica inteira", () => {
    const slots = freeSlots({
      ...base,
      appointments: [],
      blocks: [{ id: "x", professionalId: null, kind: "other", startsAt: at(8).toISOString(), endsAt: at(12).toISOString(), reason: "" }],
    });
    expect(slots[0]).toEqual(at(13));
  });

  it("respeita a antecedência mínima", () => {
    const slots = freeSlots({ ...base, appointments: [], notBefore: at(10, 15) });
    expect(slots[0]).toEqual(at(10, 30));
  });
});

describe("hasConflict", () => {
  it("detecta sobreposição e ignora o próprio agendamento na remarcação", () => {
    const list = [appt("a", at(9), at(10))];
    expect(hasConflict(list, "p1", at(9, 30), at(10, 30))).toBe(true);
    expect(hasConflict(list, "p1", at(9, 30), at(10, 30), "a")).toBe(false);
    expect(hasConflict(list, "p2", at(9, 30), at(10, 30))).toBe(false);
  });
});

describe("canTransition", () => {
  it("segue o diagrama RN-22", () => {
    expect(canTransition("requested", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "completed")).toBe(true);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(canTransition("requested", "completed")).toBe(false);
  });
});

describe("holdExpiry", () => {
  it("usa o menor entre prazo de resposta e antecedência mínima", () => {
    const now = at(8);
    expect(holdExpiry(now, new Date(2026, 10, 10, 9), 24, 2)).toEqual(new Date(2026, 10, 3, 8));
    expect(holdExpiry(now, at(14), 24, 2)).toEqual(at(12));
  });
});
