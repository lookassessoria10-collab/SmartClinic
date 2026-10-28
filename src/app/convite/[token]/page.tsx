import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthShell, linkClass } from "@/modules/auth/components/auth-shell";
import { signOut } from "@/modules/auth/actions";
import { AcceptInvitationForm, RequestLinkButton } from "@/modules/team/components/accept-invitation";
import { getCurrentUser } from "@/server/auth";
import { createSupabaseServerClient } from "@/server/supabase";
import { Button } from "@/ui/button";

export const metadata: Metadata = { title: "Convite", robots: { index: false } };

export default function InvitationPage({ params }: PageProps<"/convite/[token]">) {
  return (
    <Suspense fallback={<AuthShell title="Convite para uma clínica" description="Carregando…">{null}</AuthShell>}>
      <Invitation params={params} />
    </Suspense>
  );
}

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const user = await getCurrentUser();
  const next = `/convite/${token}`;

  // 1. Sem sessão: entrar com a conta convidada ou pedir um novo link de acesso.
  if (!user) {
    return (
      <AuthShell title="Convite para uma clínica" description="Entre com a conta do e-mail que recebeu o convite para ver e aceitar.">
        <div className="flex flex-col gap-3">
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="inline-flex h-12 items-center justify-center rounded-sm bg-accent px-5 text-body font-medium text-on-accent hover:bg-accent-hover"
          >
            Entrar
          </Link>
          <RequestLinkButton token={token} />
          <p className="text-caption text-ink-2">
            Recebeu o convite mas ainda não tem senha? Use &ldquo;Receber novo link&rdquo;: ele chega no e-mail convidado e abre o convite direto.
          </p>
        </div>
      </AuthShell>
    );
  }

  // 2. Com sessão: o banco só devolve o convite se o e-mail desta conta for o convidado.
  const supabase = await createSupabaseServerClient();
  const { data: invitation } = await supabase.rpc("get_my_invitation", { p_token: token }).maybeSingle();

  if (!invitation) {
    return (
      <AuthShell title="Convite indisponível">
        <div className="flex flex-col gap-4 text-body-sm text-ink-2">
          <p>
            Este convite expirou, foi cancelado, já foi usado ou foi enviado para outro e-mail. Você está usando a conta{" "}
            <strong className="font-medium text-ink">{user.email}</strong>.
          </p>
          <p>Se precisar, peça um novo convite a quem gerencia a clínica.</p>
          <form action={signOut}>
            <Button type="submit" variant="secondary" className="w-full">
              Sair e entrar com outra conta
            </Button>
          </form>
          <Link href="/login" className={`text-center ${linkClass}`}>
            Ir para minhas clínicas
          </Link>
        </div>
      </AuthShell>
    );
  }

  // 3. Convite válido para esta conta.
  return (
    <AuthShell title={`Convite: ${invitation.organization_name}`}>
      <AcceptInvitationForm
        token={token}
        email={user.email ?? ""}
        organizationName={invitation.organization_name}
        role={invitation.role}
        invitedBy={invitation.invited_by_name}
        expiresAt={invitation.expires_at}
        needsPassword={invitation.needs_password}
      />
    </AuthShell>
  );
}
