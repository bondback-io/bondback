"use client";

import { memo, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Post–`/auth/confirm` → onboarding (e.g. role-choice).
 * Four short steps so progress reads clearly on mobile Safari (avoids one static “stuck” line).
 */
export const AUTH_EMAIL_CONFIRM_HANDOFF_STEPS = [
  "Confirming your email...",
  "Logging you in securely...",
  "Preparing your profile...",
  "Loading role options...",
] as const;

/** Path 2 combined sign-up: overlay while `signUp` + `finalizePath2Signup` run. */
export const AUTH_EMAIL_CONFIRM_WIZARD_STEPS = [
  "Creating your account...",
  "Sending confirmation email...",
] as const;

/** @deprecated Use `AUTH_EMAIL_CONFIRM_HANDOFF_STEPS` */
export const AUTH_EMAIL_CONFIRM_STEPS = AUTH_EMAIL_CONFIRM_HANDOFF_STEPS;

/** Shorter on narrow viewports so all handoff steps appear quickly (perceived responsiveness). */
function useStepIntervalMs(mode: "handoff" | "wizardSubmit"): number {
  const [ms, setMs] = useState(280);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => {
      const mobile = mq.matches;
      setMs(mode === "wizardSubmit" ? (mobile ? 220 : 300) : mobile ? 180 : 260);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);
  return ms;
}

export type AuthEmailConfirmTransitionLoaderProps = {
  /** `full` = post–email-confirm handoff; `compact` = chunk / Suspense fallback. */
  variant?: "full" | "compact";
  /** Post-confirm handoff vs Path 2 sign-up submit overlay. */
  mode?: "handoff" | "wizardSubmit";
  className?: string;
};

function AuthEmailConfirmTransitionLoaderInner({
  variant = "full",
  mode = "handoff",
  className,
}: AuthEmailConfirmTransitionLoaderProps) {
  const reduceMotion = useReducedMotion();
  const stepMs = useStepIntervalMs(mode);
  const steps =
    mode === "wizardSubmit" ? AUTH_EMAIL_CONFIRM_WIZARD_STEPS : AUTH_EMAIL_CONFIRM_HANDOFF_STEPS;
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setStepIndex(0);
  }, [mode]);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, stepMs);
    return () => window.clearInterval(id);
  }, [reduceMotion, stepMs, steps.length]);

  /** Last step on reduced motion — matches “almost done” without cycling timers. */
  const label = reduceMotion ? steps[steps.length - 1] : steps[stepIndex];
  const effectiveStepIndex = reduceMotion ? steps.length - 1 : stepIndex;

  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center justify-center overflow-hidden",
        isCompact
          ? "min-h-[40vh] gap-5 py-12"
          : "min-h-[100dvh] gap-8 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-muted/20 dark:from-primary/12 dark:to-gray-950/70"
        aria-hidden
      />
      <div
        className={cn(
          "relative flex flex-col items-center text-center",
          isCompact ? "max-w-sm gap-4" : "max-w-md gap-6"
        )}
      >
        <p
          className={cn(
            "font-semibold tracking-tight text-primary",
            isCompact ? "text-lg" : "text-2xl sm:text-3xl"
          )}
        >
          Bond Back
        </p>
        {!isCompact && (
          <p className="-mt-2 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Bond cleaning marketplace
          </p>
        )}

        <div
          className={cn(
            "relative flex items-center justify-center",
            isCompact ? "h-14 w-14" : "h-20 w-20 sm:h-[5rem] sm:w-[5rem]"
          )}
        >
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-primary/20 dark:border-primary/35"
            aria-hidden
            animate={
              reduceMotion
                ? false
                : {
                    scale: [1, 1.06, 1],
                    opacity: [0.65, 1, 0.65],
                  }
            }
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <span
            className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary/45 dark:border-t-primary/90"
            style={{ animationDuration: "1.05s" }}
            aria-hidden
          />
          <Loader2
            className={cn(
              "relative text-primary/90",
              isCompact ? "h-7 w-7" : "h-9 w-9 sm:h-10 sm:w-10"
            )}
            strokeWidth={1.75}
            aria-hidden
          />
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="wait">
            <motion.p
              key={reduceMotion ? "static" : label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0 : 0.22 }}
              className={cn(
                "min-h-[1.5rem] font-medium text-foreground dark:text-gray-100",
                isCompact ? "text-sm" : "text-base sm:text-lg"
              )}
            >
              {label}
            </motion.p>
          </AnimatePresence>
          {!isCompact && mode === "handoff" && (
            <p className="text-sm text-muted-foreground max-sm:text-[0.8125rem] dark:text-gray-400">
              Hang tight — we&apos;re finishing sign-in in this tab.
            </p>
          )}
        </div>

        <ol
          className={cn(
            "flex w-full justify-center gap-2",
            isCompact ? "max-w-[14rem]" : "max-w-[18rem] sm:gap-2.5"
          )}
          aria-hidden
        >
          {steps.map((_, i) => (
            <li
              key={i}
              className={cn(
                "h-2 flex-1 max-w-[3.5rem] rounded-full transition-colors duration-300 ease-out",
                i <= effectiveStepIndex ? "bg-primary/85 dark:bg-primary/75" : "bg-muted dark:bg-gray-800"
              )}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

export const AuthEmailConfirmTransitionLoader = memo(AuthEmailConfirmTransitionLoaderInner);
