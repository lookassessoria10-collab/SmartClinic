"use client";

import { Suspense } from "react";
import { RequireModule } from "@/components/require-module";
import { can, useSession } from "@/components/session-context";
import { NoPermission } from "@/modules/team/components/gestao-common";
import { ProposalsManager } from "@/modules/opportunities/components/proposals-manager";

export default function ProposalsPage() {
  const session = useSession();
  // A RLS já entrega só o permitido; aqui a tela só evita uma área vazia sem explicação.
  if (!can(session, "proposals.read") && !can(session, "proposals.read_own")) return <NoPermission />;
  return (
    <RequireModule module="opportunities">
      <Suspense>
        <ProposalsManager />
      </Suspense>
    </RequireModule>
  );
}
