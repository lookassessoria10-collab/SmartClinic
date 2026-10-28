/**
 * Transforma um registro de audit_logs (gatilho app.audit_row, migração 0004) em texto
 * para a tela Gestão → Auditoria. Função pura: testável sem banco.
 *
 * Formato de `changes`: em insert/delete, a linha inteira; em update, só os campos que
 * mudaram, como { campo: { from, to } }.
 */

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface AuditRow {
  action: string;
  entity: string | null;
  entity_id: string | null;
  actor_user_id: string | null;
  actor_kind: string;
  changes: Json | null;
}

export interface Lookup {
  /** user_id → nome (equipe atual) */
  people: Record<string, string>;
  /** invitation id → e-mail convidado */
  invitationEmails: Record<string, string>;
  /** membership id → nome (no update, `changes` só traz o que mudou, sem o user_id) */
  memberNames: Record<string, string>;
}

const ROLE: Record<string, string> = { manager: "Gestor(a)", reception: "Recepção", professional: "Profissional" };
const FIELD: Record<string, string> = {
  name: "Nome",
  phone: "Telefone",
  slug: "Endereço",
  status: "Situação",
  timezone: "Fuso horário",
  display_name: "Nome",
  specialty: "Especialidade",
  active: "Ativo",
  address: "Endereço",
};
const ORG_STATUS: Record<string, string> = { trial: "Teste", active: "Ativa", suspended: "Suspensa", cancelled: "Cancelada" };

const obj = (v: Json | null | undefined): Record<string, Json | undefined> =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};
const str = (v: Json | undefined) => (v === null || v === undefined ? "—" : String(v));
const change = (c: Record<string, Json | undefined>, key: string) => {
  const v = obj(c[key]);
  return "to" in v || "from" in v ? { from: v.from, to: v.to } : null;
};

export function actorName(row: Pick<AuditRow, "actor_user_id" | "actor_kind">, lookup: Lookup) {
  if (row.actor_user_id && lookup.people[row.actor_user_id]) return lookup.people[row.actor_user_id];
  if (row.actor_kind === "system" || !row.actor_user_id) return "Sistema";
  if (row.actor_kind === "platform_admin") return "Suporte da plataforma";
  return "Pessoa que não está mais na equipe";
}

export function describeAudit(row: AuditRow, lookup: Lookup): { title: string; details: string[] } {
  const c = obj(row.changes);
  const person = (id: Json | undefined) => (typeof id === "string" && lookup.people[id]) || "uma pessoa";
  const fieldChanges = (map: (k: string, v: { from?: Json; to?: Json }) => string | null = defaultField) =>
    Object.keys(c)
      .map((k) => {
        const ch = change(c, k);
        return ch ? map(k, ch) : null;
      })
      .filter((x): x is string => Boolean(x));

  switch (row.action) {
    case "organizations.insert":
      return { title: "Clínica criada", details: [`Nome: ${str(c.name)}`] };
    case "organizations.update":
      return {
        title: "Dados da clínica alterados",
        details: fieldChanges((k, v) =>
          k === "status" ? `Situação: ${ORG_STATUS[str(v.from)] ?? str(v.from)} → ${ORG_STATUS[str(v.to)] ?? str(v.to)}` : defaultField(k, v),
        ),
      };

    case "units.insert":
      return { title: `Unidade criada: ${str(c.name)}`, details: [] };
    case "units.update":
      return { title: "Unidade alterada", details: fieldChanges() };

    case "memberships.insert":
      return { title: `${person(c.user_id)} entrou na equipe como ${ROLE[str(c.role)] ?? str(c.role)}`, details: [] };
    case "memberships.update": {
      const target = (row.entity_id && lookup.memberNames[row.entity_id]) || null;
      const role = change(c, "role");
      const status = change(c, "status");
      const who = target ?? "membro da equipe";
      if (status && status.to === "disabled") return { title: `Acesso de ${who} desativado`, details: [] };
      if (status && status.to === "active") return { title: `Acesso de ${who} reativado`, details: [] };
      if (role) return { title: `Papel de ${who} alterado`, details: [`${ROLE[str(role.from)] ?? str(role.from)} → ${ROLE[str(role.to)] ?? str(role.to)}`] };
      return { title: `Vínculo de ${who} alterado`, details: fieldChanges() };
    }
    case "memberships.delete":
      return { title: `${person(c.user_id)} saiu da equipe`, details: [] };

    case "invitations.insert":
      return { title: `Convite enviado para ${str(c.email)}`, details: [`Papel: ${ROLE[str(c.role)] ?? str(c.role)}`] };
    case "invitations.update": {
      const email = (row.entity_id && lookup.invitationEmails[row.entity_id]) || "uma pessoa";
      if (change(c, "accepted_at")) return { title: `Convite aceito por ${email}`, details: [] };
      if (change(c, "revoked_at")) return { title: `Convite para ${email} cancelado ou substituído`, details: [] };
      return { title: `Convite para ${email} alterado`, details: [] };
    }

    case "professionals.insert":
      return { title: `Profissional cadastrado: ${str(c.display_name)}`, details: c.specialty ? [`Especialidade: ${str(c.specialty)}`] : [] };
    case "professionals.update":
      return { title: "Dados de profissional alterados", details: fieldChanges() };
  }
  return { title: row.action, details: [] };
}

function defaultField(k: string, v: { from?: Json; to?: Json }) {
  const label = FIELD[k];
  return label ? `${label}: ${str(v.from)} → ${str(v.to)}` : null;
}

/** Filtros da tela (valores vêm da URL e são validados aqui). */
export const AUDIT_GROUPS = {
  todos: { label: "Tudo", entities: null },
  equipe: { label: "Equipe", entities: ["memberships"] },
  convites: { label: "Convites", entities: ["invitations"] },
  clinica: { label: "Clínica e unidades", entities: ["organizations", "units"] },
  profissionais: { label: "Profissionais", entities: ["professionals"] },
} as const;
export type AuditGroup = keyof typeof AUDIT_GROUPS;

export const AUDIT_PERIODS = { "7": "Últimos 7 dias", "30": "Últimos 30 dias", "90": "Últimos 90 dias" } as const;
export type AuditPeriod = keyof typeof AUDIT_PERIODS;

/** Início do período (ISO). `now` injetável para testes. */
export function periodStart(period: AuditPeriod, now: Date = new Date()) {
  return new Date(now.getTime() - Number(period) * 86_400_000).toISOString();
}
