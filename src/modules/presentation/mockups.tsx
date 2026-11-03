import type { ReactNode } from "react";
import {
  CalendarClock, CalendarDays, CalendarX2, Check, CheckCircle2, ChevronRight, Inbox, Lock, Receipt, Repeat, ScrollText,
  Settings2, ShieldCheck, Sparkles, UserX, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { BrandMark, Wordmark } from "@/ui/brand";
import { cn } from "@/lib/cn";
import { Illustrative } from "./layouts";

/*
 * Telas de exemplo desenhadas com os mesmos tokens do app. São ilustrações (aria-hidden não:
 * o texto ajuda quem usa leitor de tela a entender a tela), sempre com a legenda de dados fictícios.
 */

export function Window({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <figure className={cn("overflow-hidden rounded-[22px] border border-white/70 bg-canvas shadow-[0_24px_60px_rgb(6_47_94/0.22)]", className)}>
      <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex items-center gap-1.5 text-caption font-medium text-ink-2">
          <BrandMark className="size-4 text-[9px]" />
          <Wordmark className="text-[13px] text-ink" /> · {title}
        </span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
      <figcaption>
        <Illustrative />
      </figcaption>
    </figure>
  );
}

const BLOCKS: { day: number; top: number; h: number; who: string; what: string; color: number; status?: "pending" | "noshow" }[] = [
  { day: 0, top: 0, h: 2, who: "Ana Souza", what: "Consulta", color: 1 },
  { day: 0, top: 3, h: 1, who: "Bruno Lima", what: "Retorno", color: 2 },
  { day: 1, top: 1, h: 2, who: "Carla Dias", what: "Avaliação", color: 3 },
  { day: 1, top: 4, h: 1, who: "Davi Rocha", what: "Consulta", color: 1, status: "noshow" },
  { day: 2, top: 0, h: 1, who: "Eva Martins", what: "Limpeza", color: 2 },
  { day: 2, top: 2, h: 2, who: "Helena Costa", what: "Avaliação", color: 4 },
  { day: 3, top: 1, h: 1, who: "Fábio Reis", what: "Consulta", color: 3 },
  { day: 4, top: 0, h: 3, who: "Gabi Nunes", what: "Procedimento", color: 1 },
];

/** Agenda da semana com blocos coloridos por profissional. */
export function MockWeek() {
  const days = ["Seg 9", "Ter 10", "Qua 11", "Qui 12", "Sex 13"];
  return (
    <Window title="Agenda">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">9 – 13 de março</p>
        <span className="glass inline-flex rounded-full border p-0.5 text-caption">
          {["Dia", "Semana", "Mês"].map((v) => (
            <span key={v} className={cn("rounded-full px-2.5 py-1", v === "Semana" ? "bg-white font-medium text-accent shadow-sm" : "text-ink-2")}>
              {v}
            </span>
          ))}
        </span>
      </div>
      <div className="grid grid-cols-[2.25rem_repeat(5,minmax(0,1fr))] gap-1 text-[11px]">
        <span />
        {days.map((d) => (
          <span key={d} className="pb-1 text-center font-medium text-ink-2">
            {d}
          </span>
        ))}
        {[8, 9, 10, 11, 12].map((h, row) => (
          <div key={h} className="contents">
            <span className="tabular pt-0.5 text-right text-ink-3">{h}h</span>
            {days.map((d, col) => {
              const b = BLOCKS.find((x) => x.day === col && x.top === row);
              const covered = BLOCKS.some((x) => x.day === col && row > x.top && row < x.top + x.h);
              if (covered) return null;
              return b ? (
                <span
                  key={d}
                  style={{ gridRow: `span ${b.h}`, background: b.status ? undefined : `var(--agenda-${b.color}-bg)`, borderColor: `var(--agenda-${b.color})` }}
                  className={cn(
                    "flex min-h-9 flex-col rounded-[8px] border-l-[3px] px-1.5 py-1 leading-tight",
                    b.status === "pending" && "stripes-pending border border-dashed border-warning bg-warning-subtle",
                    b.status === "noshow" && "border border-dashed border-danger bg-surface",
                  )}
                >
                  <span className="truncate font-semibold text-ink">{b.who}</span>
                  <span className="truncate text-ink-2">{b.what}</span>
                </span>
              ) : (
                <span key={d} className="min-h-9 rounded-[8px] border border-dashed border-line bg-surface/60" />
              );
            })}
          </div>
        ))}
      </div>
    </Window>
  );
}

function FakeField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption font-medium text-ink">{label}</span>
      <span className="flex h-9 items-center rounded-[8px] border border-line-strong bg-surface px-2.5 text-body-sm">{value}</span>
      {hint && <span className="text-caption text-ink-3">{hint}</span>}
    </div>
  );
}

/** Painel lateral de novo agendamento. */
export function MockBooking() {
  return (
    <Window title="Novo agendamento">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-[12px] border border-accent bg-accent-subtle/60 p-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-white text-caption font-semibold text-accent">AS</span>
          <span className="min-w-0">
            <span className="block text-body-sm font-medium">Ana Souza</span>
            <span className="tabular block text-caption text-ink-2">(11) 90000-0001</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FakeField label="Profissional" value="Dra. Bia Prado" />
          <FakeField label="Serviço" value="Consulta" hint="30 min + 10 de intervalo" />
          <FakeField label="Data" value="Ter, 10 de março" />
          <FakeField label="Horário" value="09:30" hint="Só horários livres" />
        </div>
        <span className="glass-tint inline-flex h-10 items-center justify-center rounded-full text-body-sm font-medium">Agendar</span>
      </div>
    </Window>
  );
}

const OPP: { icon: LucideIcon; kind: string; title: string; context: string; tag: string; tagClass: string; value?: string; action: string }[] = [
  { icon: CalendarX2, kind: "Horário liberado", title: "Horário liberado · Dra. Bia", context: "Amanhã às 10:00 · Consulta · 2 pessoas na lista de espera", tag: "Prioridade alta", tagClass: "bg-danger-subtle text-danger", value: "R$ 200,00 estimados", action: "Ver sugestões (2)" },
  { icon: CalendarClock, kind: "Horários livres", title: "6 horários livres · Dr. Caio", context: "Qui, 12 de mar · 14:00–17:00 · Avaliação (30 min)", tag: "Prioridade média", tagClass: "bg-warning-subtle text-warning", value: "R$ 900,00 estimados", action: "Agendar" },
  { icon: Repeat, kind: "Retorno pendente", title: "Retorno de Bruno Lima", context: "Com Dra. Bia · prazo até 20/03", tag: "Prioridade média", tagClass: "bg-warning-subtle text-warning", action: "Agendar" },
  { icon: Receipt, kind: "Orçamento sem atualização", title: "Orçamento de Carla Dias", context: "Sem atualização desde 02/03 · válido até 30/03", tag: "Prioridade alta", tagClass: "bg-danger-subtle text-danger", value: "R$ 1.450,00 em orçamento", action: "Registrar contato" },
];

export function MockOpportunityCard({ i = 0, compact }: { i?: number; compact?: boolean }) {
  const o = OPP[i];
  return (
    <div className="flex flex-col gap-2.5 rounded-[16px] border border-white/80 bg-surface p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-accent-subtle text-accent">
          <o.icon className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-caption font-medium text-ink-2">{o.kind}</p>
          <p className="text-body-sm font-semibold">{o.title}</p>
          {!compact && <p className="text-caption text-ink-2">{o.context}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-caption">
        <span className={cn("rounded-full px-2 py-0.5 font-medium", o.tagClass)}>{o.tag}</span>
        {o.value && <span className="tabular ml-auto font-semibold">{o.value}</span>}
      </div>
      {!compact && (
        <div className="flex gap-2">
          <span className="glass-tint inline-flex h-8 items-center rounded-full px-3 text-caption font-medium">{o.action}</span>
          <span className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-caption font-medium text-ink-2">
            Detalhes <ChevronRight className="size-3.5" aria-hidden />
          </span>
        </div>
      )}
    </div>
  );
}

export function MockIndicators() {
  const items: { label: string; value: string; hint: string; icon: LucideIcon }[] = [
    { label: "Receita potencial em risco", value: "R$ 4.800", hint: "Estimativa pelo preço", icon: Wallet },
    { label: "Horários disponíveis", value: "24", hint: "Próximos 14 dias", icon: CalendarClock },
    { label: "Em aberto", value: "11", hint: "3 de prioridade alta", icon: Inbox },
    { label: "Resolvidas", value: "18", hint: "Últimos 14 dias", icon: CheckCircle2 },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((s) => (
        <div key={s.label} className="rounded-[16px] border border-white/80 bg-surface p-3 shadow-sm">
          <p className="flex items-center justify-between gap-2 text-caption font-medium text-ink-2">
            {s.label} <s.icon className="size-3.5 shrink-0 text-ink-3" aria-hidden />
          </p>
          <p className="tabular mt-1 text-title-2 font-semibold">{s.value}</p>
          <p className="text-caption text-ink-2">{s.hint}</p>
        </div>
      ))}
    </div>
  );
}

export function MockOpportunities() {
  return (
    <Window title="Oportunidades">
      <div className="flex flex-col gap-3">
        <MockIndicators />
        <div className="flex flex-wrap gap-1.5 text-caption">
          {["Todas 11", "Agenda 6", "Pacientes 3", "Financeiro 2", "Resolvidas"].map((t, i) => (
            <span key={t} className={cn("rounded-full border px-2.5 py-1 font-medium", i === 0 ? "border-accent bg-accent-subtle text-accent" : "border-line-strong text-ink-2")}>
              {t}
            </span>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <MockOpportunityCard i={0} compact />
          <MockOpportunityCard i={1} compact />
        </div>
      </div>
    </Window>
  );
}

/** Ciclo de vida de uma oportunidade. */
export function MockStatusFlow({ dark }: { dark?: boolean }) {
  const pill = (text: string, cls: string) => <span className={cn("rounded-full px-3 py-1.5 text-body-sm font-semibold", cls)}>{text}</span>;
  const arrow = <ChevronRight className={cn("size-4 shrink-0", dark ? "text-white/60" : "text-ink-3")} aria-hidden />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {pill("Nova", "bg-accent-subtle text-accent")}
        {arrow}
        {pill("Em andamento", "bg-warning-subtle text-warning")}
        {arrow}
        {pill("Resolvida", "bg-success-subtle text-success")}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {pill("Descartada · com motivo", "bg-muted text-ink-2")}
        {pill("Expirada · o prazo passou", "bg-muted text-ink-2")}
      </div>
    </div>
  );
}

export function MockHistory() {
  const rows = [
    ["Identificada pelo sistema", "Sistema", "09/03 08:02"],
    ["Contato: Não atendeu · “ligar à tarde”", "Recepção · Lia", "09/03 10:15"],
    ["Responsável: Lia", "Gestão · Rita", "09/03 10:16"],
    ["Agendamento feito", "Recepção · Lia", "09/03 15:40"],
  ];
  return (
    <ol className="flex flex-col gap-2 border-l-2 border-line pl-4 text-body-sm">
      {rows.map(([what, who, when]) => (
        <li key={what}>
          <span className="font-medium">{what}</span>
          <span className="block text-caption text-ink-2">
            {who} · {when}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Quem vê o quê (resumo da matriz real de permissões, docs/04). */
export function MockPermissions() {
  const rows: [string, string, string, string][] = [
    ["Agenda de todos", "Vê e edita", "Vê e edita", "Própria; colegas como “ocupado”"],
    ["Pacientes", "Todos", "Todos", "Os que atende ou cadastrou"],
    ["Oportunidades", "Todas, com valores", "Todas; valores se liberado", "As próprias, com valores"],
    ["Orçamentos", "Todos", "Todos", "Os próprios"],
    ["Equipe e configurações", "Sim", "—", "—"],
    ["Auditoria", "Sim", "—", "—"],
  ];
  return (
    <div className="overflow-x-auto rounded-[22px] border border-line bg-surface shadow-sm">
      <table className="w-full min-w-[34rem] text-left text-body-sm">
        <caption className="sr-only">Permissões por perfil</caption>
        <thead className="bg-canvas text-caption text-ink-2">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-semibold">O quê</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Gestão</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Recepção</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Profissional</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r[0]}>
              <th scope="row" className="px-4 py-2.5 font-medium">{r[0]}</th>
              {r.slice(1).map((c, i) => (
                <td key={i} className="px-4 py-2.5 text-ink-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MockAudit() {
  const rows = [
    ["Rita (gestão) alterou o preço de Consulta", "10:02"],
    ["Lia (recepção) remarcou um agendamento", "10:15"],
    ["Paciente: campos alterados — telefone", "10:31"],
    ["Novo membro convidado: recepção", "11:04"],
  ];
  return (
    <Window title="Auditoria">
      <ol className="divide-y divide-line text-body-sm">
        {rows.map(([what, when]) => (
          <li key={what} className="flex items-center gap-3 py-2">
            <ScrollText className="size-4 shrink-0 text-ink-3" aria-hidden />
            <span className="min-w-0 flex-1">{what}</span>
            <span className="tabular text-caption text-ink-2">{when}</span>
          </li>
        ))}
      </ol>
    </Window>
  );
}

/** Início de cada perfil, lado a lado. */
export function MockHomes() {
  const homes: { who: string; icon: LucideIcon; lines: string[] }[] = [
    { who: "Gestão", icon: Settings2, lines: ["Atendimentos hoje e na semana", "Faltas dos últimos 30 dias", "Estimativa do mês", "Primeiros passos"] },
    { who: "Recepção", icon: Users, lines: ["Agenda de hoje", "Ações rápidas: agendar e cadastrar", "Próximos pacientes", "Resumo das Oportunidades"] },
    { who: "Profissional", icon: CalendarDays, lines: ["Meus atendimentos de hoje", "Concluído / Faltou em um toque", "Próximos dias", "Minhas oportunidades"] },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {homes.map((h) => (
        <div key={h.who} className="rounded-[22px] border border-line bg-surface p-4 shadow-sm">
          <p className="mb-2 flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-[10px] bg-accent-subtle text-accent">
              <h.icon className="size-4" aria-hidden />
            </span>
            {h.who}
          </p>
          <ul className="flex flex-col gap-1.5 text-body-sm text-ink-2">
            {h.lines.map((l) => (
              <li key={l} className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden /> {l}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Garantias de segurança em selos. */
export function SecurityBadges() {
  const items: { icon: LucideIcon; text: string }[] = [
    { icon: Lock, text: "Clínicas isoladas no banco" },
    { icon: ShieldCheck, text: "Verificação em duas etapas" },
    { icon: ScrollText, text: "Auditoria só-anexar" },
    { icon: UserX, text: "Sem dados clínicos" },
    { icon: Sparkles, text: "Sem IA paga, sem envio automático" },
  ];
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((i) => (
        <li key={i.text} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-body-sm text-white">
          <i.icon className="size-4 text-[#8ccbf2]" aria-hidden /> {i.text}
        </li>
      ))}
    </ul>
  );
}
