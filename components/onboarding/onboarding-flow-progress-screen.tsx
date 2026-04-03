"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const AUTH_STEPS = [
  "Confirming your email…",
  "Logging you in…",
  "Preparing your profile…",
  "Loading role selection…",
] as const;

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
/** Route-level `loading.tsx` / Suspense fallback — calm branded shell without step timers. */
export function OnboardingRouteLoadingFallback() {
  return (
    <div
      className="relative flex min-h-[50vh] w-full flex-col items-center justify-center gap-6 px-4 py-20"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.05] via-transparent to-muted/15 dark:from-primary/10 dark:to-gray-950/50"
        aria-hidden
      />
      <div className="relative flex flex-col items-center gap-5 text-center">
        <p className="text-lg font-semibold text-primary">Bond Back</p>
        <div className="relative flex h-14 w-14 items-center justify-center">
          <span
            className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary/35"
            style={{ animationDuration: "1.1s" }}
            aria-hidden
          />
          <Loader2 className="relative h-7 w-7 text-primary" strokeWidth={1.75} aria-hidden />
        </div>
        <p className="max-w-xs text-sm text-muted-foreground">Loading your onboarding…</p>
      </div>
    </div>
  );
}

export function OnboardingFlowProgressScreen({
  authReady,
  roleTransition,
  className,
}: OnboardingFlowProgressScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (authReady) return;
    const id = window.setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, AUTH_STEPS.length - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [authReady]);

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

  return (
    <div
      className={cn(
        "relative flex min-h-[calc(100dvh-6rem)] w-full max-w-lg flex-col items-center justify-center gap-8 overflow-hidden px-4 py-16 sm:max-w-2xl md:max-w-4xl",
        className
      )}
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.05] via-transparent to-muted/20 dark:from-primary/10 dark:to-gray-950/60"
        aria-hidden
      />
      <div className="relative flex w-full max-w-md flex-col items-center text-center">
        <p className="text-xl font-semibold tracking-tight text-primary sm:text-2xl">Bond Back</p>
        <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Getting you set up
        </p>
        <div className="relative mt-10 flex flex-col items-center gap-6">
          <div className="relative flex h-16 w-16 items-center justify-center sm:h-[4.5rem] sm:w-[4.5rem]">
            <span
              className="absolute inset-0 rounded-full border-2 border-primary/20 dark:border-primary/30"
              aria-hidden
            />
            <span
              className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary/35 dark:border-t-primary/85"
              style={{ animationDuration: "1.15s" }}
              aria-hidden
            />
            <Loader2 className="relative h-8 w-8 text-primary sm:h-9 sm:w-9" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="space-y-3">
            <p className="min-h-[1.5rem] text-base font-medium text-foreground transition-all duration-300 dark:text-gray-100">
              {AUTH_STEPS[stepIndex]}
            </p>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              This usually takes just a moment — stay on this screen.
            </p>
          </div>
          <ol className="flex w-full max-w-[18rem] justify-center gap-2 sm:gap-2.5" aria-hidden>
            {AUTH_STEPS.map((_, i) => (
              <li
                key={i}
                className={cn(
                  "h-2 flex-1 max-w-[3.5rem] rounded-full transition-all duration-500",
                  i <= stepIndex ? "bg-primary/85 dark:bg-primary/75" : "bg-muted dark:bg-gray-800"
                )}
              />
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
