"use client";

import { Suspense } from "react";
import { WaitingListManager } from "@/modules/opportunities/components/waiting-list-manager";

export default function WaitingListPage() {
  return (
    <Suspense>
      <WaitingListManager />
    </Suspense>
  );
}
