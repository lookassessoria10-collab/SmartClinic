import { describe as group, expect, it } from "vitest";
import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import type { Db, OpportunityItem } from "@/prototype/types";
import { feedArgs, filtersQuery, parseFilters } from "./filters";
import { describe, explainValue, valueLabel } from "./labels";
import { followUpSchema, proposalSchema, statusSchema, waitingSchema } from "./schemas";
import { bookingHref, firstBookableSlot, opportunityBooking } from "./booking";

const PRO = "11111111-1111-4111-8111-111111111111";
const SVC = "22222222-2222-4222-8222-222222222222";
const PAT = "33333333-3333-4333-8333-333333333333";

function item(patch: Partial<OpportunityItem>): OpportunityItem {
  return {
    id: "44444444-4444-4444-8444-444444444444", kind: "free_slots", category: "agenda", status: "new", priority: 2,
    professional_id: PRO, patient_id: null, service_id: SVC, appointment_id: null, follow_up_id: null, proposal_id: null,
    window_start: null, window_end: null, slot_count: 3, value_cents: 45000, value_visible: true,
    basis: { method: "free_slots", slots: 3, free_minutes: 100, slot_minutes: 30, service_name: "Consulta", unit_price_cents: 15000, reference: "shortest" },
    assigned_to: null, detected_at: new Date().toISOString(), expires_at: null, resolved_at: null, resolution: null,
    dismiss_reason: null, matches: 0, last_action_at: null, ...patch,
  };
}

group("filtros da URL", () => {
  it("valores desconhecidos viram o padrão", () => {
    expect(parseFilters({ tab: "x", periodo: "999", ordem: "drop table", profissional: "não-é-uuid", pagina: "-3" })).toEqual({
      tab: "todas", period: "14", sort: "prioridade", professional: "", page: 1,
    });
  });

  it("aba Resolvidas pede encerradas; categorias viram filtro do banco", () => {
    expect(feedArgs("org", parseFilters({ tab: "resolvidas" }))).toMatchObject({ p_view: "closed", p_category: undefined });
    expect(feedArgs("org", parseFilters({ tab: "financeiro", ordem: "valor", periodo: "30" }))).toMatchObject({
      p_view: "open", p_category: "financeiro", p_sort: "value", p_days: 30,
    });
  });

  it('"Mostrar mais" acumula páginas sem passar do limite do banco (100)', () => {
    expect(feedArgs("org", parseFilters({ pagina: "4" })).p_limit).toBe(100);
    expect(parseFilters({ pagina: "5" }).page).toBe(1);
  });

  it("URL limpa: só o que difere do padrão", () => {
    const f = parseFilters({});
    expect(filtersQuery(f)).toBe("");
    expect(filtersQuery(f, { tab: "agenda", professional: PRO })).toBe(`?tab=agenda&profissional=${PRO}`);
  });
});

group("textos e valores", () => {
  it("falta e cancelamento em linguagem neutra, sem valor somado", () => {
    const noShow = item({ kind: "no_show", category: "pacientes", patient_id: PAT, value_cents: null, window_start: new Date().toISOString() });
    expect(describe(noShow, { patient: "Ana", professional: "Dra. Bia" }).title).toBe("Ana não compareceu");
    expect(describe(noShow, { patient: "Ana" }).title).not.toMatch(/desinteress/i);
    expect(valueLabel(noShow)).toBeNull();
  });

  it("valor só aparece para quem pode ver; sem preço vira indisponível, nunca zero", () => {
    expect(valueLabel(item({ value_visible: false }))).toBeNull();
    expect(valueLabel(item({ value_cents: null }))).toBe("Valor indisponível");
    expect(valueLabel(item({}))).toMatch(/estimados$/);
  });

  it("como calculamos: quantidade × preço e aviso de que não é faturamento garantido", () => {
    const lines = explainValue(item({}));
    expect(lines.join(" ")).toMatch(/3 × R\$\s?150,00 = R\$\s?450,00/);
    expect(lines.at(-1)).toMatch(/não é faturamento garantido/);
    expect(explainValue(item({ value_visible: false }))).toEqual(["Os valores ficam visíveis para a gestão da clínica."]);
  });

  it("orçamento nunca é chamado de receita perdida", () => {
    const p = item({ kind: "proposal_stale", category: "financeiro", value_cents: 30000, basis: { method: "proposal", total_cents: 30000, items: 2 } });
    expect(explainValue(p).join(" ")).toMatch(/não é receita perdida nem garantida/);
  });
});

group("validação das ações", () => {
  it("descartar exige motivo", () => {
    const id = "44444444-4444-4444-8444-444444444444";
    expect(statusSchema.safeParse({ id, status: "dismissed", reason: "" }).success).toBe(false);
    expect(statusSchema.safeParse({ id, status: "dismissed", reason: "Mudou de cidade" }).success).toBe(true);
    expect(statusSchema.safeParse({ id, status: "new" }).success).toBe(false); // reabrir à mão não existe
  });

  it("lista de espera: sem preferência vira nulo; datas na ordem", () => {
    expect(waitingSchema.parse({ patientId: PAT, weekdays: [], periods: [] })).toMatchObject({ weekdays: null, periods: null, serviceId: null });
    expect(waitingSchema.safeParse({ patientId: PAT, earliestDate: "2026-12-10", latestDate: "2026-12-01" }).success).toBe(false);
  });

  it("retorno precisa de profissional e prazo; orçamento precisa de itens", () => {
    expect(followUpSchema.safeParse({ patientId: PAT, professionalId: "", dueDate: "2026-12-01" }).success).toBe(false);
    expect(proposalSchema.safeParse({ patientId: PAT, title: "Plano", items: [] }).success).toBe(false);
    expect(proposalSchema.safeParse({ patientId: PAT, title: "Plano", items: [{ quantity: 1, unitPriceCents: 100 }] }).success).toBe(false);
  });
});

group("do cartão para a agenda", () => {
  const monday = startOfDay(addDays(new Date(), 7 - ((new Date().getDay() + 6) % 7) + 7)); // segunda daqui a 1–2 semanas
  const db = {
    services: [{ id: SVC, name: "Consulta", category: "", durationMin: 30, bufferAfterMin: 0, priceCents: 15000, isPublic: true, showPrice: false, active: true, professionalIds: [PRO] }],
    professionals: [{ id: PRO, name: "Dra. Bia", specialty: "", color: 1, acceptsPublic: true, active: true, userId: null }],
    availability: [{ professionalId: PRO, weekday: 1, start: "08:00", end: "10:00" }],
    blocks: [],
    appointments: [{ id: "a", professionalId: PRO, serviceId: SVC, patientId: PAT, startsAt: setMinutes(setHours(monday, 8), 0).toISOString(), endsAt: setMinutes(setHours(monday, 8), 30).toISOString(), status: "confirmed", origin: "staff", createdAt: "" }],
  } as unknown as Db;

  it("primeiro horário agendável respeita ocupação e grade de 15 min", () => {
    const slot = firstBookableSlot(db, PRO, SVC, setMinutes(setHours(monday, 7), 52));
    expect(slot?.getHours()).toBe(8);
    expect(slot?.getMinutes()).toBe(30);
  });

  it("horário liberado não sugere nada fora do próprio intervalo", () => {
    const from = setHours(monday, 9);
    expect(firstBookableSlot(db, PRO, SVC, from, setMinutes(from, 30))?.getHours()).toBe(9);
    expect(firstBookableSlot(db, PRO, SVC, setHours(monday, 11), setHours(monday, 12))).toBeNull();
  });

  it("link leva profissional, serviço, oportunidade e nunca agenda sozinho", () => {
    const b = opportunityBooking(db, item({ window_start: setHours(monday, 8).toISOString() }))!;
    const href = bookingHref("clinica", b);
    expect(href).toMatch(/^\/c\/clinica\/agenda\?novo=1&/);
    expect(href).toContain(`profissional=${PRO}`);
    expect(href).toContain("oportunidade=");
    expect(opportunityBooking(db, item({ status: "resolved" }))).toBeNull();
  });
});
