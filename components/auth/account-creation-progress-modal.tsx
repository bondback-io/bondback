"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useSupportContactDisplayEmail } from "@/components/providers/support-contact-provider";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export const SIGNUP_ACCOUNT_STEPS_SESSION = [
  { id: "auth", label: "Creating your Bond Back account…" },
  { id: "profile", label: "Saving your name and postcode…" },
  { id: "finalizing", label: "Taking you to role choice…" },
] as const;

export const SIGNUP_ACCOUNT_STEPS_EMAIL = [
  { id: "auth", label: "Creating your Bond Back account…" },
  { id: "email", label: "Saving your details for after you verify…" },
  { id: "finalizing", label: "Almost done…" },
] as const;

export const ONBOARDING_AUTO_COMPLETE_STEPS = [
  { id: "session", label: "Checking your session…" },
  { id: "profile", label: "Completing your profile…" },
  { id: "finalizing", label: "Taking you to your dashboard…" },
] as const;

export const ONBOARDING_SIGNUP_FORM_STEPS = [
  { id: "auth", label: "Creating your Bond Back account…" },
  { id: "profile", label: "Completing your profile…" },
  { id: "finalizing", label: "Taking you to your dashboard…" },
] as const;

export type AccountCreationProgressPhase = "running" | "success" | "error";

export type AccountCreationStep = { id: string; label: string };

type AccountCreationProgressModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: AccountCreationProgressPhase;
  progress: number;
  steps: readonly AccountCreationStep[];
  activeStepId: string;
  /** Main title while running */
  titleRunning: string;
  /** Subtitle while running */
  subtitleRunning: string;
  successTitle?: string;
  successSubtitle?: string;
  errorMessage?: string | null;
  failureHint?: string | null;
  onRetry?: () => void;
  supportEmail?: string;
};

/**
 * Same interaction pattern as listing publish — sky accent for account / onboarding (listings use emerald).
 */
export function AccountCreationProgressModal({
  open,
  onOpenChange,
  phase,
  progress,
  steps,
  activeStepId,
  titleRunning,
  subtitleRunning,
  successTitle = "You’re all set!",
  successSubtitle = "Continuing…",
  errorMessage,
  failureHint,
  onRetry,
  supportEmail: supportEmailProp,
}: AccountCreationProgressModalProps) {
  const supportEmailFallback = useSupportContactDisplayEmail();
  const supportEmail = supportEmailProp ?? supportEmailFallback;
  const blocking = phase === "running" || phase === "success";
  const clamped = Math.min(100, Math.max(0, progress));

  const handleOpenChange = (next: boolean) => {
    if (!next && blocking) return;
    onOpenChange(next);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay className="bg-black/50 backdrop-blur-[2px] dark:bg-black/70" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col gap-4 border border-sky-200/80 bg-gradient-to-b from-sky-50/95 via-background to-background p-6 shadow-2xl duration-200 dark:border-sky-900/50 dark:from-sky-950/90 dark:via-gray-950 dark:to-gray-950",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "max-md:inset-0 max-md:h-full max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none max-md:border-0 max-md:p-5",
            "md:left-1/2 md:top-1/2 md:max-h-[min(90vh,32rem)] md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:p-7"
          )}
          onPointerDownOutside={(e) => blocking && e.preventDefault()}
          onEscapeKeyDown={(e) => blocking && e.preventDefault()}
          onInteractOutside={(e) => blocking && e.preventDefault()}
        >
          {blocking && (
            <span className="sr-only">
              Creating your account. Please wait; this dialog cannot be closed until finished.
            </span>
          )}

          <div className="flex flex-col gap-1 pr-8">
            <DialogPrimitive.Title className="text-lg font-semibold leading-snug text-sky-950 dark:text-sky-50 sm:text-xl">
              {phase === "success" ? successTitle : phase === "error" ? "Something went wrong" : titleRunning}
            </DialogPrimitive.Title>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              {phase === "success"
                ? successSubtitle
                : phase === "error"
                  ? "Fix the issue below or try again."
                  : subtitleRunning}
            </p>
          </div>

          {phase !== "error" && phase !== "success" && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium tabular-nums text-muted-foreground dark:text-gray-400">
                  <span>Progress</span>
                  <span>{Math.round(clamped)}%</span>
                </div>
                <Progress
                  value={clamped}
                  className="h-2.5 bg-sky-100/80 dark:bg-sky-950/80"
                  indicatorClassName="bg-gradient-to-r from-sky-500 to-sky-600 transition-[transform] duration-500 ease-out dark:from-sky-400 dark:to-sky-500"
                />
              </div>

              <ul className="space-y-2.5 text-sm" aria-live="polite">
                {steps.map((step, i) => {
                  const idx = steps.findIndex((s) => s.id === activeStepId);
                  const done = i < idx;
                  const current = step.id === activeStepId;
                  return (
                    <li
                      key={step.id}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
                        current && "bg-sky-100/70 dark:bg-sky-950/50",
                        done && "opacity-70"
                      )}
                    >
                      {done ? (
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400"
                          aria-hidden
                        />
                      ) : current ? (
                        <Loader2
                          className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-600 dark:text-sky-400"
                          aria-hidden
                        />
                      ) : (
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/35 dark:bg-gray-600"
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          "leading-snug",
                          current
                            ? "font-medium text-foreground dark:text-gray-100"
                            : "text-muted-foreground dark:text-gray-400"
                        )}
                      >
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {phase === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950/80">
                <CheckCircle2 className="h-9 w-9 text-sky-600 dark:text-sky-400" aria-hidden />
              </div>
              <p className="text-center text-sm text-muted-foreground dark:text-gray-400">{successSubtitle}</p>
            </div>
          )}

          {phase === "error" && failureHint && (
            <p className="text-xs text-muted-foreground dark:text-gray-500">{failureHint}</p>
          )}

          {phase === "error" && errorMessage && (
            <div
              role="alert"
              className="flex gap-3 rounded-xl border border-slate-200 bg-slate-100/95 px-4 py-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
              <p className="whitespace-pre-line leading-relaxed text-slate-700 dark:text-slate-200">{errorMessage}</p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col gap-2">
              {onRetry && (
                <Button
                  type="button"
                  className="w-full bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500"
                  onClick={onRetry}
                >
                  Retry
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                className="w-full text-slate-700 dark:text-slate-300"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <a
                href={`mailto:${supportEmail}?subject=Bond%20Back%20—%20account%20help`}
                className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Contact support
              </a>
            </div>
          )}

          {!blocking && phase !== "error" && phase !== "success" && (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground ring-offset-background transition-opacity hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring dark:text-gray-400 dark:hover:bg-gray-800">
              <span className="sr-only">Close</span>
              <span aria-hidden className="text-lg leading-none">
                ×
              </span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
