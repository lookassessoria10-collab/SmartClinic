import type { Metadata } from "next";
import { connection } from "next/server";
import { requireMember } from "@/server/auth";
import { ScheduleSettings } from "@/modules/catalog/components/schedule-settings";
import { BackToGestao, NoPermission } from "@/modules/team/components/gestao-common";

export const metadata: Metadata = { title: "Horários" };
export const instant = false;

export default async function HoursPage({ params }: PageProps<"/c/[org]/gestao/horarios">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  if (!ctx.permissions.has("availability.manage")) return <NoPermission />;
  return (
    <>
      <BackToGestao slug={org} />
      <ScheduleSettings writable={ctx.writable} />
    </>
  );
}
