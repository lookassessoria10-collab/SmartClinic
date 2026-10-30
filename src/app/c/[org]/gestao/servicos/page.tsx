import type { Metadata } from "next";
import { connection } from "next/server";
import { requireMember } from "@/server/auth";
import { ServicesManager } from "@/modules/catalog/components/services-manager";
import { BackToGestao, NoPermission } from "@/modules/team/components/gestao-common";

export const metadata: Metadata = { title: "Serviços" };
export const instant = false;

export default async function ServicesPage({ params }: PageProps<"/c/[org]/gestao/servicos">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  if (!ctx.permissions.has("services.manage")) return <NoPermission />;
  return (
    <>
      <BackToGestao slug={org} />
      <ServicesManager writable={ctx.writable} />
    </>
  );
}
