import { AuthEmailConfirmTransitionLoader } from "@/components/onboarding/auth-email-confirm-transition-loader";

/**
 * Shown while RSC resolves session + profile for role-choice (email-confirm → onboarding).
 * Matches the multi-step handoff so the wait feels intentional, not stuck.
 */
export function RoleChoiceSegmentLoading() {
  return (
    <section className="page-inner flex min-h-[min(100dvh,720px)] flex-col items-center justify-center py-8">
      <AuthEmailConfirmTransitionLoader variant="compact" mode="handoff" />
    </section>
  );
}
