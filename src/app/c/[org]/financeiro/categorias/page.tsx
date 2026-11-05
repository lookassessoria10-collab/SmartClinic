import type { Metadata } from "next";
import { connection } from "next/server";
import { requireMember } from "@/server/auth";
import { createSupabaseServerClient } from "@/server/supabase";
import { NoPermission } from "@/modules/team/components/gestao-common";
import { loadCategories } from "@/modules/finance/server";
import { CategoriesManager } from "@/modules/finance/components/categories-manager";

export const metadata: Metadata = { title: "Categorias" };
export const instant = false;

export default async function FinanceCategoriesPage({ params }: PageProps<"/c/[org]/financeiro/categorias">) {
  await connection();
  const { org } = await params;
  const ctx = await requireMember(org);
  if (!ctx.permissions.has("finance.read")) return <NoPermission />;
  const supabase = await createSupabaseServerClient();
  return <CategoriesManager categories={await loadCategories(supabase, ctx.organization.id)} writable={ctx.writable} />;
}
