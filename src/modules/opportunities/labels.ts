import {
  CalendarClock, CalendarMinus, CalendarX2, Receipt, Repeat, UserX, type LucideIcon,
} from "lucide-react";
import type {
  ContactOutcome, DayPeriod, OpportunityCategory, OpportunityItem, OpportunityKind, OpportunityStatus,
} from "@/prototype/types";
import { dayLabel, fmt, money, time } from "@/lib/format";

/*
 * Textos do módulo Oportunidades (docs/17). Linguagem neutra: falta e cancelamento são fatos,
 * nunca "desinteresse"; valores são sempre "estimativa", nunca faturamento garantido.
 */

export const KIND_META: Record<OpportunityKind, { label: string; icon: LucideIcon; category: OpportunityCategory }> = {
  free_slots: { label: "Horários livres", icon: CalendarClock, category: "agenda" },
  cancelled_slot: { label: "Horário liberado", icon: CalendarX2, category: "agenda" },
  follow_up_due: { label: "Retorno pendente", icon: Repeat, category: "pacientes" },
  proposal_stale: { label: "Orçamento sem atualização", icon: Receipt, category: "financeiro" },
  no_show: { label: "Falta sem novo agendamento", icon: UserX, category: "pacientes" },
  cancelled_appointment: { label: "Cancelamento sem remarcação", icon: CalendarMinus, category: "pacientes" },
};

export const KIND_ORDER: OpportunityKind[] = ["free_slots", "cancelled_slot", "follow_up_due", "no_show", "cancelled_appointment", "proposal_stale"];

export const PRIORITY_META: Record<1 | 2 | 3, { label: string; className: string }> = {
  1: { label: "Prioridade alta", className: "bg-danger-subtle text-danger" },
  2: { label: "Prioridade média", className: "bg-warning-subtle text-warning" },
  3: { label: "Prioridade baixa", className: "bg-muted text-ink-2" },
};

export const STATUS_LABEL: Record<OpportunityStatus, string> = {
  new: "Nova",
  in_progress: "Em andamento",
  resolved: "Resolvida",
  dismissed: "Descartada",
  expired: "Expirada",
};

export const OUTCOME_LABEL: Record<ContactOutcome, string> = {
  no_answer: "Não atendeu",
  call_back: "Vai retornar",
  scheduled: "Combinou um horário",
  not_now: "Prefere deixar para depois",
  other: "Outro",
};

export const PERIOD_LABEL: Record<DayPeriod, string> = { morning: "Manhã", afternoon: "Tarde", evening: "Noite" };
export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface Names {
  professional?: string;
  patient?: string;
  service?: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const day = (iso: string) => fmt(`${iso}T12:00`, "dd/MM");

/** Título e contexto curtos do cartão (uma linha cada). */
export function describe(item: OpportunityItem, names: Names, now = new Date()): { title: string; context: string } {
  const pro = names.professional ?? "Profissional";
  const patient = names.patient ?? "Paciente";
  const service = names.service ?? item.basis?.service_name ?? undefined;
  switch (item.kind) {
    case "free_slots": {
      const n = item.slot_count ?? 0;
      const span = item.window_start && item.window_end ? `${time(item.window_start)}–${time(item.window_end)}` : "";
      return {
        title: `${plural(n, "horário livre", "horários livres")} · ${pro}`,
        context: [item.window_start && dayLabel(item.window_start), span, service && `${service}${item.basis?.slot_minutes ? ` (${item.basis.slot_minutes} min)` : ""}`]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "cancelled_slot":
      return {
        title: `Horário liberado · ${pro}`,
        context: [item.window_start && `${dayLabel(item.window_start)} às ${time(item.window_start)}`, service, item.matches ? plural(item.matches, "pessoa na lista de espera", "pessoas na lista de espera") : null]
          .filter(Boolean)
          .join(" · "),
      };
    case "follow_up_due": {
      const due = item.basis?.due_date;
      const overdue = due ? due < fmt(now, "yyyy-MM-dd") : false;
      return {
        title: `Retorno de ${patient}`,
        context: [`Com ${pro}`, due && (overdue ? `prazo venceu em ${day(due)}` : `prazo até ${day(due)}`), service].filter(Boolean).join(" · "),
      };
    }
    case "proposal_stale":
      return {
        title: `Orçamento de ${patient}`,
        context: [
          item.basis?.last_activity_at && `Sem atualização desde ${fmt(item.basis.last_activity_at, "dd/MM")}`,
          item.basis?.valid_until && `válido até ${day(item.basis.valid_until)}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "no_show":
      return {
        title: `${patient} não compareceu`,
        context: [item.window_start && `${fmt(item.window_start, "dd/MM 'às' HH:mm")}`, `com ${pro}`, "sem novo agendamento"].filter(Boolean).join(" · "),
      };
    case "cancelled_appointment":
      return {
        title: `${patient}: agendamento cancelado`,
        context: [item.window_start && `Era ${fmt(item.window_start, "dd/MM 'às' HH:mm")}`, `com ${pro}`, "sem remarcação"].filter(Boolean).join(" · "),
      };
  }
}

/** Valor do cartão: estimativa, indisponível (sem preço) ou nada (sem permissão). */
export function valueLabel(item: Pick<OpportunityItem, "kind" | "value_cents" | "value_visible">): string | null {
  if (!item.value_visible) return null;
  if (item.kind === "no_show" || item.kind === "cancelled_appointment") return null;
  if (item.value_cents == null) return item.kind === "follow_up_due" ? null : "Valor indisponível";
  return item.kind === "proposal_stale" ? `${money(item.value_cents)} em orçamento` : `${money(item.value_cents)} estimados`;
}

/** "Como calculamos", em português, a partir do registro do banco. */
export function explainValue(item: Pick<OpportunityItem, "kind" | "value_cents" | "value_visible" | "basis">): string[] {
  const b = item.basis;
  if (!b) return [];
  if (!item.value_visible) return ["Os valores ficam visíveis para a gestão da clínica."];
  switch (b.method) {
    case "free_slots":
      return [
        `${plural(b.free_minutes ?? 0, "minuto livre", "minutos livres")} no horário de atendimento, já descontados bloqueios, agendamentos e horários liberados por cancelamento.`,
        `Cabem ${plural(b.slots ?? 0, "atendimento", "atendimentos")} de ${b.slot_minutes} min de ${b.service_name ?? "serviço"} (${b.reference === "most_booked" ? "o serviço mais agendado com este profissional nos últimos 90 dias" : "o serviço mais curto deste profissional"}).`,
        b.unit_price_cents == null
          ? "Sem preço cadastrado para o serviço: o valor fica indisponível. Informe o preço em Gestão → Serviços."
          : `${b.slots} × ${money(b.unit_price_cents)} = ${money(item.value_cents)}.`,
        "Estimativa pelo preço de tabela; não é faturamento garantido.",
      ];
    case "cancelled_slot":
      return [
        `Horário de ${b.slot_minutes} min liberado por um cancelamento.`,
        b.unit_price_cents == null ? "Sem preço cadastrado para o serviço." : `Preço de ${b.service_name}: ${money(b.unit_price_cents)}.`,
        "Este horário não entra na conta dos horários livres do dia (sem contar duas vezes).",
      ];
    case "follow_up":
      return [
        b.service_name ? `Serviço do retorno: ${b.service_name}${b.unit_price_cents != null ? `, ${money(b.unit_price_cents)}` : ""}.` : "Retorno sem serviço definido.",
        "O valor de retornos não entra na receita potencial em risco.",
      ];
    case "proposal":
      return [
        `Total do orçamento: ${money(b.total_cents ?? item.value_cents)} (${plural(b.items ?? 0, "item", "itens")}).`,
        "Orçamento em aberto não é receita perdida nem garantida.",
      ];
    case "none":
      return ["Acompanhamento do paciente, sem valor associado: o horário em si já está nas oportunidades de agenda."];
  }
}
