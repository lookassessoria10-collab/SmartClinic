import { describe, expect, it } from "vitest";
import { actorName, describeAudit, type AuditRow, type Lookup } from "./describe";

const lookup: Lookup = {
  people: { u1: "Ana Ribeiro", u2: "Bruno Costa" },
  invitationEmails: { i1: "nova@exemplo.test" },
  memberNames: { m2: "Bruno Costa" },
};
const row = (action: string, changes: AuditRow["changes"], extra: Partial<AuditRow> = {}): AuditRow => ({
  action, entity: action.split(".")[0], entity_id: null, actor_user_id: "u1", actor_kind: "member", changes, ...extra,
});

describe("describeAudit", () => {
  // Formato real do gatilho: no update, `changes` só traz o que mudou (sem user_id).
  it("troca de papel vira frase com antes → depois", () => {
    const r = describeAudit(row("memberships.update", { role: { from: "reception", to: "professional" } }, { entity_id: "m2" }), lookup);
    expect(r).toEqual({ title: "Papel de Bruno Costa alterado", details: ["Recepção → Profissional"] });
  });

  it("desativação e reativação", () => {
    expect(describeAudit(row("memberships.update", { status: { from: "active", to: "disabled" } }, { entity_id: "m2" }), lookup).title)
      .toBe("Acesso de Bruno Costa desativado");
    expect(describeAudit(row("memberships.update", { status: { from: "disabled", to: "active" } }, { entity_id: "m2" }), lookup).title)
      .toBe("Acesso de Bruno Costa reativado");
  });

  it("vínculo de quem não está mais na lista ainda gera frase", () => {
    expect(describeAudit(row("memberships.update", { status: { from: "active", to: "disabled" } }, { entity_id: "mx" }), lookup).title)
      .toBe("Acesso de membro da equipe desativado");
  });

  it("entrada na equipe usa o nome e o papel (no insert vem a linha inteira)", () => {
    expect(describeAudit(row("memberships.insert", { user_id: "u2", role: "reception" }), lookup).title)
      .toBe("Bruno Costa entrou na equipe como Recepção");
  });

  it("convite: envio, aceite e cancelamento", () => {
    expect(describeAudit(row("invitations.insert", { email: "nova@exemplo.test", role: "manager" }), lookup))
      .toEqual({ title: "Convite enviado para nova@exemplo.test", details: ["Papel: Gestor(a)"] });
    expect(describeAudit(row("invitations.update", { accepted_at: { from: null, to: "2026-10-29" } }, { entity_id: "i1" }), lookup).title)
      .toBe("Convite aceito por nova@exemplo.test");
    expect(describeAudit(row("invitations.update", { revoked_at: { from: null, to: "2026-10-29" } }, { entity_id: "i1" }), lookup).title)
      .toBe("Convite para nova@exemplo.test cancelado ou substituído");
  });

  it("alteração da clínica lista os campos conhecidos e traduz a situação", () => {
    const r = describeAudit(
      row("organizations.update", { name: { from: "A", to: "B" }, status: { from: "active", to: "suspended" }, campo_interno: { from: 1, to: 2 } }),
      lookup,
    );
    expect(r.details).toEqual(["Nome: A → B", "Situação: Ativa → Suspensa"]);
  });

  it("ação desconhecida não quebra a tela", () => {
    expect(describeAudit(row("algo.novo", null), lookup)).toEqual({ title: "algo.novo", details: [] });
  });
});

describe("actorName", () => {
  it("nome da equipe, sistema ou ex-membro", () => {
    expect(actorName({ actor_user_id: "u1", actor_kind: "member" }, lookup)).toBe("Ana Ribeiro");
    expect(actorName({ actor_user_id: null, actor_kind: "system" }, lookup)).toBe("Sistema");
    expect(actorName({ actor_user_id: "u9", actor_kind: "member" }, lookup)).toBe("Pessoa que não está mais na equipe");
  });
});
