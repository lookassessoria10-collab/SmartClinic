"use client";

import { Suspense } from "react";
import { FollowUpsManager } from "@/modules/opportunities/components/follow-ups-manager";

export default function FollowUpsPage() {
  return (
    <Suspense>
      <FollowUpsManager />
    </Suspense>
  );
}
