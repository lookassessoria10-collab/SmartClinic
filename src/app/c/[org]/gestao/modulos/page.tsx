import type { Metadata } from "next";
import { connection } from "next/server";
import { requireMember } from "@/server/auth";
import { ModulesForm } from "@/modules/finance/components/modules-form";
import { BackToGestao, NoPermission } from "@/modules/team/components/gestao-common";

export const metadata: Metadata = { title: "Módulos" };
export const instant = false;

export default async function ModulesPage({ params }: PageProps<"/c/[org]/gestao/modulos">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  if (!ctx.permissions.has("org.settings")) return <NoPermission />;
  return (
    <>
      <BackToGestao slug={org} />
      <ModulesForm writable={ctx.writable} />
    </>
  );
}
