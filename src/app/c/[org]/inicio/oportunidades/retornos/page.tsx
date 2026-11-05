"use client";

import { Suspense } from "react";
import { RequireModule } from "@/components/require-module";
import { FollowUpsManager } from "@/modules/opportunities/components/follow-ups-manager";

export default function FollowUpsPage() {
  return (
    <RequireModule module="opportunities">
      <Suspense>
        <FollowUpsManager />
      </Suspense>
    </RequireModule>
  );
}
