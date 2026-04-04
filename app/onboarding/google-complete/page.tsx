import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { getPostLoginDashboardPath } from "@/lib/auth/post-login-redirect";
import { authPerfDevLog } from "@/lib/auth/auth-perf-dev";
import { OnboardingRouteLoadingFallback } from "@/components/onboarding/onboarding-flow-progress-screen";
import { GoogleSignupCompleteClient } from "@/components/onboarding/google-signup-complete-client";

export const metadata: Metadata = {
  title: "Complete your profile",
  description:
    "Finish signing up after Google — choose lister or cleaner and add your ABN if you clean on Bond Back.",
};

/**
 * Post–Google OAuth: role + optional ABN before dashboard. Email/password Path 2 is unchanged.
 */
export default async function GoogleCompletePage() {
  const rscT0 = Date.now();
  const sessionData = await getSessionWithProfile();
  authPerfDevLog("onboarding/google-complete:getSessionWithProfile", {
    ms: Date.now() - rscT0,
  });

  if (!sessionData) {
    redirect("/login?next=/onboarding/google-complete");
  }

  const { roles, activeRole } = sessionData;
  const hasActiveRole = activeRole != null;
  if (roles.length > 0 && hasActiveRole) {
    redirect(
      getPostLoginDashboardPath({
        roles: sessionData.roles,
        active_role: sessionData.activeRole,
      })
    );
  }

  return (
    <section className="page-inner flex min-h-[60vh] flex-col items-center justify-center">
      <Suspense fallback={<OnboardingRouteLoadingFallback />}>
        <GoogleSignupCompleteClient />
      </Suspense>
    </section>
  );
}
