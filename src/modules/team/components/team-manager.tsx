"use client";

import { useActionState, useState, useTransition } from "react";
import { Clock, MailPlus, RotateCw, Send, Stethoscope, UserX, Users, X } from "lucide-react";
import {
  cancelInvitation, changeMemberRole, inviteMember, resendInvitation, setMemberStatus, type ActionState,
} from "@/modules/team/actions";
import { ROLE_OPTIONS } from "@/modules/team/errors";
import { FormNotice } from "@/modules/auth/components/auth-shell";
import { Avatar, Card, CardHeader, EmptyState, PageHeader } from "@/ui/primitives";
import { Badge } from "@/ui/status-badge";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Field, Input, Select } from "@/ui/field";
import { useToast } from "@/ui/toast";
import { expiresIn } from "@/lib/format";
import { cn } from "@/lib/cn";

type Role = "manager" | "reception" | "professional";

interface Member {
  membershipId: string;
  userId: string;
  name: string;
  email: string | null;
  role: Role;
  status: "invited" | "active" | "disabled";
  isProfessional: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
}

const roleLabel = (r: string) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;

export function TeamManager({
  slug, currentUserId, writable, members, invitations,
}: {
  slug: string;
  currentUserId: string;
  writable: boolean;
  members: Member[];
  invitations: Invitation[];
}) {
  const active = members.filter((m) => m.status === "active");
  const inactive = members.filter((m) => m.status !== "active");

  return (
    <>
      <PageHeader title="Equipe" description="Quem acessa a clínica e com qual papel. Mudanças valem a partir da próxima ação da pessoa." />
      {!writable && (
        <div className="mb-4">
          <FormNotice tone="info">A clínica está em modo somente leitura: não é possível convidar nem alterar a equipe.</FormNotice>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Pessoas com acesso" description={`${active.length} ativa${active.length === 1 ? "" : "s"}`} icon={Users} />
            <ul className="divide-y divide-line border-t border-line">
              {active.map((m) => (
                <MemberRow key={m.membershipId} slug={slug} member={m} isSelf={m.userId === currentUserId} writable={writable} />
              ))}
            </ul>
          </Card>

          {inactive.length > 0 && (
            <Card>
              <CardHeader title="Acesso desativado" description="Não conseguem abrir a clínica. Os registros continuam." icon={UserX} />
              <ul className="divide-y divide-line border-t border-line">
                {inactive.map((m) => (
                  <MemberRow key={m.membershipId} slug={slug} member={m} isSelf={m.userId === currentUserId} writable={writable} />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <InviteCard slug={slug} writable={writable} />
          <Card>
            <CardHeader title="Convites pendentes" icon={Clock} />
            {invitations.length === 0 ? (
              <EmptyState icon={Send} title="Nenhum convite pendente" className="py-6" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {invitations.map((i) => (
                  <InvitationRow key={i.id} slug={slug} invitation={i} writable={writable} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function InviteCard({ slug, writable }: { slug: string; writable: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteMember.bind(null, slug), {});
  const [role, setRole] = useState<Role>("reception");
  // Depois de um convite enviado, o formulário volta limpo (nova chave = novo formulário).
  const formKey = state.ok ? state.message : "form";

  return (
    <Card>
      <CardHeader title="Convidar pessoa" description="Ela recebe um e-mail com o link para entrar." icon={MailPlus} />
      <form key={formKey} action={action} noValidate className="flex flex-col gap-4 px-5 pb-5">
        {state.message && <FormNotice tone={state.ok ? "success" : "danger"}>{state.message}</FormNotice>}
        <Field label="E-mail" error={state.fields?.email}>
          <Input name="email" type="email" inputMode="email" autoComplete="off" defaultValue={state.ok ? "" : state.values?.email} disabled={!writable} />
        </Field>
        <Field label="Papel" error={state.fields?.role} hint={ROLE_OPTIONS.find((r) => r.value === role)?.description}>
          <Select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={!writable}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" loading={pending} disabled={!writable}>
          <Send className="size-4" aria-hidden /> Enviar convite
        </Button>
      </form>
    </Card>
  );
}

function MemberRow({ slug, member, isSelf, writable }: { slug: string; member: Member; isSelf: boolean; writable: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const disabled = member.status !== "active";

  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      toast({ message: r.message ?? (r.ok ? "Feito." : "Não foi possível concluir."), tone: r.ok ? "success" : "danger" });
    });

  return (
    <li className={cn("flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center", pending && "opacity-60")}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={member.name} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{member.name}</span>
            {isSelf && <Badge>Você</Badge>}
            {member.isProfessional && (
              <Badge className="bg-accent-subtle text-accent">
                <Stethoscope className="size-3" aria-hidden /> Atende
              </Badge>
            )}
          </p>
          {member.email && <p className="truncate text-body-sm text-ink-2">{member.email}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`role-${member.membershipId}`}>
          Papel de {member.name}
        </label>
        <Select
          id={`role-${member.membershipId}`}
          value={member.role}
          disabled={!writable || pending || disabled}
          onChange={(e) => run(() => changeMemberRole(slug, member.membershipId, e.target.value))}
          className="h-10 min-w-36 text-body-sm"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        {disabled ? (
          <Button variant="secondary" size="sm" disabled={!writable || pending} onClick={() => run(() => setMemberStatus(slug, member.membershipId, "active"))}>
            Reativar
          </Button>
        ) : (
          !isSelf && (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger-subtle hover:text-danger"
              disabled={!writable || pending}
              onClick={() => setConfirm(true)}
            >
              Desativar
            </Button>
          )
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive
        title={`Desativar o acesso de ${member.name}?`}
        description="A pessoa deixa de conseguir abrir a clínica imediatamente. Nada do que ela registrou é apagado, e você pode reativar depois."
        confirmLabel="Desativar acesso"
        onConfirm={() => run(() => setMemberStatus(slug, member.membershipId, "disabled"))}
      />
    </li>
  );
}

function InvitationRow({ slug, invitation, writable }: { slug: string; invitation: Invitation; writable: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const expired = new Date(invitation.expiresAt) <= new Date();

  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      toast({ message: r.message ?? "Feito.", tone: r.ok ? "success" : "danger" });
    });

  return (
    <li className={cn("flex flex-col gap-2 px-5 py-3.5", pending && "opacity-60")}>
      <div className="min-w-0">
        <p className="truncate font-medium">{invitation.email}</p>
        <p className="text-caption text-ink-2">
          {roleLabel(invitation.role)} ·{" "}
          {expired ? <span className="font-medium text-danger">Expirado</span> : <>expira em {expiresIn(invitation.expiresAt)}</>}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={!writable || pending} onClick={() => run(() => resendInvitation(slug, invitation.id))}>
          <RotateCw className="size-3.5" aria-hidden /> Reenviar
        </Button>
        <Button variant="ghost" size="sm" disabled={!writable || pending} onClick={() => setConfirm(true)}>
          <X className="size-3.5" aria-hidden /> Cancelar
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive
        title="Cancelar este convite?"
        description={`O link enviado para ${invitation.email} deixa de funcionar. Você pode convidar de novo depois.`}
        confirmLabel="Cancelar convite"
        onConfirm={() => run(() => cancelInvitation(slug, invitation.id))}
      />
    </li>
  );
}
