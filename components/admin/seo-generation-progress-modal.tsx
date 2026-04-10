"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogOverlay } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2 } from "lucide-react";

export const SEO_GENERATION_STEPS = [
  { id: "landing", label: "Generating landing page…" },
  { id: "blog", label: "Creating blog posts…" },
  { id: "faq", label: "Adding FAQ schema…" },
  { id: "sitemap", label: "Updating sitemap…" },
  { id: "routing", label: "Adding to dynamic routing…" },
] as const;

export type SeoGenerationStepId = (typeof SEO_GENERATION_STEPS)[number]["id"];

export type SeoGenerationProgressPhase = "running" | "success" | "error";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: SeoGenerationProgressPhase;
  progress: number;
  activeStepId: SeoGenerationStepId;
  errorMessage?: string | null;
};

/**
 * Same layout as listing creation progress — emerald theme, step list, blocking while running.
 */
export function SeoGenerationProgressModal({
  open,
  onOpenChange,
  phase,
  progress,
  activeStepId,
  errorMessage,
}: Props) {
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
          <div className="flex flex-col gap-1 pr-8">
            <DialogPrimitive.Title className="text-lg font-semibold leading-snug text-emerald-950 dark:text-emerald-50 sm:text-xl">
              {phase === "success"
                ? "SEO content generated"
                : phase === "error"
                  ? "Generation failed"
                  : "Generating SEO content…"}
            </DialogPrimitive.Title>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              {phase === "success"
                ? "Pages and sitemap will refresh on next visit."
                : phase === "error"
                  ? "Fix the issue below and try again."
                  : "Sit tight — we’re building landing copy, articles, and structured data."}
            </p>
          </div>

          {phase === "running" && (
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
                {SEO_GENERATION_STEPS.map((step, i) => {
                  const idx = SEO_GENERATION_STEPS.findIndex((s) => s.id === activeStepId);
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
            </div>
          )}

          {phase === "error" && errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
            >
              {errorMessage}
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
