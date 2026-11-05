"use client";

import { Suspense } from "react";
import { RequireModule } from "@/components/require-module";
import { WaitingListManager } from "@/modules/opportunities/components/waiting-list-manager";

export default function WaitingListPage() {
  return (
    <RequireModule module="opportunities">
      <Suspense>
        <WaitingListManager />
      </Suspense>
    </RequireModule>
  );
}
