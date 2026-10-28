import type { Metadata } from "next";
import { connection } from "next/server";
import { ScrollText } from "lucide-react";
import { requireMember } from "@/server/auth";
import { createSupabaseServerClient } from "@/server/supabase";
import { BackToGestao, NoPermission } from "@/modules/team/components/gestao-common";
import {
  AUDIT_GROUPS, AUDIT_PERIODS, actorName, describeAudit, periodStart, type AuditGroup, type AuditPeriod, type Lookup,
} from "@/modules/audit/describe";
import { Card, EmptyState, PageHeader } from "@/ui/primitives";
import { Button } from "@/ui/button";
import { Select } from "@/ui/field";
import { cap, fmt, time } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoria" };
export const instant = false;

const LIMIT = 100;

export default async function AuditPage({ params, searchParams }: PageProps<"/c/[org]/gestao/auditoria">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  if (!ctx.permissions.has("audit.read")) return <NoPermission />;

  // Filtros vêm da URL: só valores conhecidos são aceitos.
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const period: AuditPeriod = one(sp.periodo) in AUDIT_PERIODS ? (one(sp.periodo) as AuditPeriod) : "30";
  const group: AuditGroup = one(sp.tipo) in AUDIT_GROUPS ? (one(sp.tipo) as AuditGroup) : "todos";

  const supabase = await createSupabaseServerClient();
  const { data: team } = await supabase.rpc("list_team", { p_org: ctx.organization.id });
  const people = Object.fromEntries((team ?? []).map((m) => [m.user_id, m.full_name]));
  const memberNames = Object.fromEntries((team ?? []).map((m) => [m.membership_id, m.full_name]));
  const person = one(sp.pessoa) in people ? one(sp.pessoa) : "";

  const since = periodStart(period);
  let query = supabase
    .from("audit_logs")
    .select("id, created_at, action, entity, entity_id, actor_user_id, actor_kind, changes")
    .eq("organization_id", ctx.organization.id)
    .gte("created_at", since)
    .order("id", { ascending: false })
    .limit(LIMIT);
  const entities = AUDIT_GROUPS[group].entities;
  if (entities) query = query.in("entity", [...entities]);
  if (person) query = query.eq("actor_user_id", person);
  const { data: rows, error } = await query;
  if (error) throw new Error(`Falha ao carregar a auditoria: ${error.message}`);

  // Convites: no update, o registro não traz o e-mail; busca pelos ids envolvidos.
  const invitationIds = [...new Set(rows.filter((r) => r.entity === "invitations" && r.entity_id).map((r) => r.entity_id!))];
  const { data: invites } = invitationIds.length
    ? await supabase.from("invitations").select("id, email").in("id", invitationIds)
    : { data: [] as { id: string; email: string }[] };
  const lookup: Lookup = { people, memberNames, invitationEmails: Object.fromEntries((invites ?? []).map((i) => [i.id, i.email])) };

  // Agrupa por dia (fuso do navegador do servidor; o fuso da clínica chega com as unidades).
  const days = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = fmt(r.created_at, "yyyy-MM-dd");
    days.set(key, [...(days.get(key) ?? []), r]);
  }

  return (
    <>
      <BackToGestao slug={org} />
      <PageHeader
        title="Auditoria"
        description="Quem fez o quê e quando na equipe, nos convites e nos dados da clínica. O registro não pode ser alterado nem apagado."
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2" aria-label="Filtros da auditoria">
        <label className="flex flex-col gap-1 text-caption text-ink-2">
          Período
          <Select name="periodo" defaultValue={period} className="h-10 min-w-44 text-body-sm">
            {Object.entries(AUDIT_PERIODS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink-2">
          Tipo
          <Select name="tipo" defaultValue={group} className="h-10 min-w-44 text-body-sm">
            {Object.entries(AUDIT_GROUPS).map(([v, g]) => (
              <option key={v} value={v}>
                {g.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink-2">
          Pessoa
          <Select name="pessoa" defaultValue={person} className="h-10 min-w-48 text-body-sm">
            <option value="">Todas</option>
            {(team ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="Nenhum registro neste filtro" description="Tente um período maior ou outro tipo." />
        ) : (
          <div className="divide-y divide-line">
            {[...days.entries()].map(([day, items]) => (
              <section key={day} aria-label={cap(fmt(items[0].created_at, "EEEE, d 'de' MMMM"))}>
                <h2 className="bg-canvas px-5 py-2 text-caption font-semibold text-ink-2">{cap(fmt(items[0].created_at, "EEEE, d 'de' MMMM 'de' yyyy"))}</h2>
                <ol className="divide-y divide-line">
                  {items.map((r) => {
                    const d = describeAudit(r, lookup);
                    return (
                      <li key={r.id} className="flex gap-4 px-5 py-3 text-body-sm">
                        <time dateTime={r.created_at} className="tabular w-12 shrink-0 text-ink-2">
                          {time(r.created_at)}
                        </time>
                        <div className="min-w-0">
                          <p className="font-medium">{d.title}</p>
                          {d.details.map((x) => (
                            <p key={x} className="text-ink-2">
                              {x}
                            </p>
                          ))}
                          <p className="text-caption text-ink-2">por {actorName(r, lookup)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </Card>
      {rows.length === LIMIT && (
        <p className="mt-3 text-caption text-ink-2">Mostrando os {LIMIT} registros mais recentes. Use os filtros para ver registros mais antigos.</p>
      )}
    </>
  );
}
