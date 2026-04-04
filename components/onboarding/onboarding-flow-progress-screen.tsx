"use client";

import { memo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthEmailConfirmTransitionLoader } from "@/components/onboarding/auth-email-confirm-transition-loader";

type RoleTransitionCopy = {
  title: string;
  subtitle: string;
};

type OnboardingFlowProgressScreenProps = {
  /** While false, show stepped “confirmation → role” progress (email-confirm landing). */
  authReady: boolean;
  /** Full-screen takeover after role tap; page navigates via `location.assign` so this stays until unload. */
  roleTransition: RoleTransitionCopy | null;
  className?: string;
};

/**
 * Branded multi-step loader for post-email-confirm → role-choice, plus role → quick-setup transition.
 */
/** Route-level `loading.tsx` / Suspense — same step language as post-confirm handoff (compact). */
export function OnboardingRouteLoadingFallback() {
  return (
    <div className="min-h-[50vh] w-full py-6">
      <AuthEmailConfirmTransitionLoader variant="compact" />
    </div>
  );
}

function OnboardingFlowProgressScreenInner({
  authReady,
  roleTransition,
  className,
}: OnboardingFlowProgressScreenProps) {
  if (roleTransition) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-[300] flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]",
          className
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.07] via-transparent to-muted/25 dark:from-primary/12 dark:to-gray-950/85"
          aria-hidden
        />
        <div className="relative flex w-full max-w-md flex-col items-center text-center">
          <p className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Bond Back</p>
          <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Bond cleaning marketplace
          </p>
          <div className="relative mt-10 flex flex-col items-center gap-6">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full border-2 border-primary/25 dark:border-primary/35"
                aria-hidden
              />
              <span
                className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary/40 dark:border-t-primary/90"
                style={{ animationDuration: "1.1s" }}
                aria-hidden
              />
              <Loader2 className="relative h-9 w-9 text-primary/90" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="space-y-2">
              <p className="text-base font-medium text-foreground dark:text-gray-100">{roleTransition.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
                {roleTransition.subtitle}
              </p>
            </div>
            <div className="mt-2 h-1 w-full max-w-[14rem] overflow-hidden rounded-full bg-muted dark:bg-gray-800">
              <div
                className="h-full w-2/5 animate-pulse rounded-full bg-primary/70 dark:bg-primary/80"
                style={{ animationDuration: "1.4s" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authReady) return null;

  return <AuthEmailConfirmTransitionLoader variant="full" className={className} />;
}

export const OnboardingFlowProgressScreen = memo(OnboardingFlowProgressScreenInner);
