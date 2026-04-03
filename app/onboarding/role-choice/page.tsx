import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { authPerfDevLog } from "@/lib/auth/auth-perf-dev";
import { OnboardingRouteLoadingFallback } from "@/components/onboarding/onboarding-flow-progress-screen";
import { RoleChoiceClient } from "@/components/onboarding/role-choice-client";

/**
 * Auth-only: user arrives after `/signup` (or `/dashboard` when `roles` is empty).
 * `?ref=` is still accepted on `/signup`; referral is applied in minimal profile upsert.
 */
export const metadata: Metadata = {
  title: "Choose your role",
  description:
    "Choose lister or cleaner to continue onboarding on Bond Back — bond cleaning and end of lease jobs.",
};

export default async function RoleChoicePage() {
  const rscT0 = Date.now();
  /**
   * Same cached fetch as root layout — avoids a second `getSession` + `profiles` round-trip
   * on this navigation (major win after email confirm when layout + page both need session).
   */
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

  /** Session + profile already validated above — client can render role UI without waiting on browser `getSession`. */
  return (
    <section className="page-inner flex min-h-[60vh] flex-col items-center justify-center">
      <Suspense fallback={<OnboardingRouteLoadingFallback />}>
        <RoleChoiceClient serverSessionReady />
      </Suspense>
    </section>
  );
}
