import type { Metadata } from "next";
import { connection } from "next/server";
import { getMyProfile, requireMember } from "@/server/auth";
import { createSupabaseServerClient } from "@/server/supabase";
import { SecuritySettings } from "@/modules/auth/components/security-settings";
import { PageHeader } from "@/ui/primitives";

export const metadata: Metadata = { title: "Minha conta" };
export const instant = false;

export default async function AccountPage({ params }: PageProps<"/c/[org]/conta">) {
  // Cada página é pré-renderizada à parte; o cliente Supabase consulta o relógio (validade do token).
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  const supabase = await createSupabaseServerClient();
  const [profile, factors] = await Promise.all([getMyProfile(), supabase.auth.mfa.listFactors()]);

  const verified = (factors.data?.totp ?? [])
    .filter((f) => f.status === "verified")
    .map((f) => ({ id: f.id, name: f.friendly_name ?? "Aplicativo autenticador", createdAt: f.created_at }));

  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados de acesso. Valem para todas as clínicas em que você está." />
      <SecuritySettings
        name={profile?.fullName ?? ""}
        email={ctx.user.email ?? ""}
        factors={verified}
        recommended={ctx.role === "manager"}
      />
    </>
  );
}
