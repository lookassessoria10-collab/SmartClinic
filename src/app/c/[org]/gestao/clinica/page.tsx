import type { Metadata } from "next";
import { connection } from "next/server";
import { requireMember } from "@/server/auth";
import { createSupabaseServerClient } from "@/server/supabase";
import { ClinicSettings } from "@/modules/team/components/clinic-settings";
import { BackToGestao, NoPermission } from "@/modules/team/components/gestao-common";

export const metadata: Metadata = { title: "Clínica" };
export const instant = false;

export default async function ClinicPage({ params, searchParams }: PageProps<"/c/[org]/gestao/clinica">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  if (!ctx.permissions.has("org.settings")) return <NoPermission />;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("name, slug, phone, timezone, segment, status")
    .eq("id", ctx.organization.id)
    .single();
  if (error) throw new Error(`Falha ao carregar a clínica: ${error.message}`);

  const saved = (await searchParams).salvo === "1";
  return (
    <>
      <BackToGestao slug={org} />
      <ClinicSettings slug={org} writable={ctx.writable} clinic={data} slugJustChanged={saved} />
    </>
  );
}
