"use client";

import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useSupportContactDisplayEmail } from "@/components/providers/support-contact-provider";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export const LISTING_CREATION_STEPS = [
  { id: "calculating", label: "Calculating price and modifiers..." },
  { id: "creating", label: "Creating your listing record..." },
  { id: "uploading", label: "Uploading property photos..." },
  { id: "notifications", label: "Setting up job and notifications..." },
  { id: "finalizing", label: "Finalizing..." },
] as const;

export type ListingCreationStepId = (typeof LISTING_CREATION_STEPS)[number]["id"];

export type ListingCreationProgressPhase = "running" | "success" | "error";

type ListingCreationProgressModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: ListingCreationProgressPhase;
  /** 0–100 — updated as each pipeline stage runs */
  progress: number;
  activeStepId: ListingCreationStepId;
  errorMessage?: string | null;
  /** Shown under the title on error (e.g. retry count) */
  failureHint?: string | null;
  onRetry?: () => void;
  /** Save form to device; closes modal */
  onSaveDraft?: () => void;
  supportEmail?: string;
};

/**
 * Full-screen on small viewports, large centered card on desktop.
 * Blocks dismiss while `phase === "running"` or `"success"` (until parent closes after redirect).
 */
export function ListingCreationProgressModal({
  open,
  onOpenChange,
  phase,
  progress,
  activeStepId,
  errorMessage,
  failureHint,
  onRetry,
  onSaveDraft,
  supportEmail: supportEmailProp,
}: ListingCreationProgressModalProps) {
  const supportEmailFallback = useSupportContactDisplayEmail();
  const supportEmail = supportEmailProp ?? supportEmailFallback;
  /** Block dismiss while working or during success countdown before redirect */
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
            "fixed z-50 flex flex-col gap-4 border border-emerald-200/80 bg-gradient-to-b from-emerald-50/95 via-background to-background p-6 shadow-2xl duration-200 dark:border-emerald-900/50 dark:from-emerald-950/90 dark:via-gray-950 dark:to-gray-950",
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
              Creating your listing. Please wait; this dialog cannot be closed until finished.
            </span>
          )}

          <div className="flex flex-col gap-1 pr-8">
            <DialogPrimitive.Title className="text-lg font-semibold leading-snug text-emerald-950 dark:text-emerald-50 sm:text-xl">
              {phase === "success"
                ? "Listing created successfully!"
                : phase === "error"
                  ? "Couldn’t finish publishing"
                  : "Creating your bond cleaning listing..."}
            </DialogPrimitive.Title>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              {phase === "success"
                ? "Redirecting you to your listing…"
                : phase === "error"
                  ? "Choose an option below — your answers stay on the page until you leave."
                  : "Sit tight — we’re saving your property details and photos."}
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
                  className="h-2.5 bg-emerald-100/80 dark:bg-emerald-950/80"
                  indicatorClassName="bg-gradient-to-r from-emerald-500 to-emerald-600 transition-[transform] duration-500 ease-out dark:from-emerald-400 dark:to-emerald-500"
                />
              </div>

              <ul className="space-y-2.5 text-sm" aria-live="polite">
                {LISTING_CREATION_STEPS.map((step, i) => {
                  const idx = LISTING_CREATION_STEPS.findIndex((s) => s.id === activeStepId);
                  const done = i < idx;
                  const current = step.id === activeStepId;
                  return (
                    <li
                      key={step.id}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
                        current && "bg-emerald-100/70 dark:bg-emerald-950/50",
                        done && "opacity-70"
                      )}
                    >
                      {done ? (
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                      ) : current ? (
                        <Loader2
                          className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400"
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
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/80">
                <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </div>
              <p className="text-center text-sm text-muted-foreground dark:text-gray-400">
                Cleaners can now see your listing and place bids.
              </p>
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
              <p className="whitespace-pre-line leading-relaxed text-slate-700 dark:text-slate-200">
                {errorMessage}
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col gap-2">
              {onRetry && (
                <Button
                  type="button"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  onClick={onRetry}
                >
                  Retry
                </Button>
              )}
              {onSaveDraft && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-slate-300 dark:border-slate-600"
                  onClick={() => {
                    onSaveDraft();
                    onOpenChange(false);
                  }}
                >
                  Save as draft (this device)
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
              <Link
                href={`mailto:${supportEmail}?subject=Bond%20Back%20—%20listing%20help`}
                className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Contact support
              </Link>
            </div>
          )}

          {/* No default close button while blocking — Radix DialogContent in ui/dialog includes X; we use primitive Content only */}
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
