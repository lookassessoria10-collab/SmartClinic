import type { Metadata } from "next";
import { connection } from "next/server";
import { requireMember } from "@/server/auth";
import { OpportunitySettingsForm } from "@/modules/opportunities/components/settings-form";
import { BackToGestao, NoPermission } from "@/modules/team/components/gestao-common";

export const metadata: Metadata = { title: "Oportunidades" };
export const instant = false;

export default async function OpportunitySettingsPage({ params }: PageProps<"/c/[org]/gestao/oportunidades">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  if (!ctx.permissions.has("org.settings")) return <NoPermission />;
  return (
    <>
      <BackToGestao slug={org} />
      <OpportunitySettingsForm writable={ctx.writable} />
    </>
  );
}
