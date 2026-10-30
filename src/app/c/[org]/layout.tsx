import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { AppShell, ShellSkeleton } from "@/components/app-shell";
import { SessionProvider, type ClinicSession } from "@/components/session-context";
import { ClinicDataProvider } from "@/modules/clinic/client";
import { loadClinicDb } from "@/modules/clinic/server";
import { getMyMemberships, getMyProfile, requireMember } from "@/server/auth";

// Toda a área da clínica depende de quem está logado: não há casca útil para pré-renderizar
// além do esqueleto. Por isso fica fora da validação de navegação instantânea (ADR-013).
// Revisitar na Fase 4, quando as telas passarem a ser renderizadas no servidor.
export const instant = false;

// A sessão e o slug só existem na requisição: o esqueleto aparece de imediato e o
// conteúdo autenticado chega em streaming dentro do Suspense (Next 16, cacheComponents).
export default function ClinicLayout({ children, params }: LayoutProps<"/c/[org]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <ClinicFrame params={params}>{children}</ClinicFrame>
    </Suspense>
  );
}

async function ClinicFrame({ params, children }: { params: Promise<{ org: string }>; children: ReactNode }) {
  // Marca explicitamente como "da requisição": o cliente Supabase consulta o relógio
  // (validade do token) e isso não pode acontecer durante a pré-renderização.
  await connection();
  const { org } = await params;
  // 404 para quem não é membro ativo desta clínica (mesma resposta de slug inexistente).
  const ctx = await requireMember(org);
  const [profile, memberships] = await Promise.all([getMyProfile(), getMyMemberships()]);
  const name = profile?.fullName ?? ctx.user.email ?? "Você";
  // Profissionais, serviços, pacientes visíveis, horários e agenda — já filtrados pela RLS.
  const db = await loadClinicDb(ctx, name);

  const session: ClinicSession = {
    user: { id: ctx.user.id, name, email: ctx.user.email },
    organization: { id: ctx.organization.id, slug: ctx.organization.slug, name: ctx.organization.name, writable: ctx.writable },
    role: ctx.role,
    permissions: [...ctx.permissions],
    clinics: memberships.map((m) => ({ slug: m.slug, name: m.name, role: m.role })),
  };

  return (
    <SessionProvider value={session}>
      <ClinicDataProvider value={db}>
        <AppShell>{children}</AppShell>
      </ClinicDataProvider>
    </SessionProvider>
  );
}
