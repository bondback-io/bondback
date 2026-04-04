import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { authPerfDevLog } from "@/lib/auth/auth-perf-dev";
import { RoleChoiceClient } from "@/components/onboarding/role-choice-client";
import { RoleChoiceSegmentLoading } from "./role-choice-segment-loading";

/**
 * Auth-only: user arrives after `/signup` (or `/dashboard` when `roles` is empty).
 * `?ref=` is still accepted on `/signup`; referral is applied in minimal profile upsert.
 */
export const metadata: Metadata = {
  title: "Choose your role",
  description:
    "Choose lister or cleaner to continue onboarding on Bond Back — bond cleaning and end of lease jobs.",
};

/**
 * Sync shell streams immediately; `RoleChoicePageContent` suspends until session + profile resolve.
 * Avoids a single long async page boundary so the handoff loader can show as soon as React hydrates.
 */
export default function RoleChoicePage() {
  return (
    <Suspense fallback={<RoleChoiceSegmentLoading />}>
      <RoleChoicePageContent />
    </Suspense>
  );
}

async function RoleChoicePageContent() {
  const rscT0 = Date.now();
  const sessionData = await getSessionWithProfile();
  authPerfDevLog("onboarding/role-choice:getSessionWithProfile", {
    ms: Date.now() - rscT0,
    note: "React.cache — same request as layout; second call is ~0ms",
  });

  if (!sessionData) {
    redirect("/login?next=/onboarding/role-choice");
  }

  const { roles, activeRole } = sessionData;
  const hasActiveRole = activeRole != null;
  if (roles.length > 0 && hasActiveRole) {
    redirect("/dashboard");
  }

  return (
    <section className="page-inner flex min-h-[60vh] flex-col items-center justify-center">
      <RoleChoiceClient serverSessionReady />
    </section>
  );
}
