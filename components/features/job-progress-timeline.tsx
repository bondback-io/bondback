"use client";

import { Check, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type JobProgressTimelineProps = {
  detailUiBoost: boolean;
  localJobStatus: string | null;
  hasActiveJob: boolean;
  hasPaymentHold: boolean;
  allCompleted: boolean;
  hasAfterPhotos: boolean;
  isJobLister: boolean;
  isJobCleaner: boolean;
};

type StepDef = {
  id: string;
  title: string;
  done: boolean;
  hintLister: string;
  hintCleaner: string;
};

/**
 * Mobile-first vertical timeline for active jobs (lister + cleaner).
 * Replaces the old inline dot + pipe row that wrapped poorly on small screens.
 */
export function JobProgressTimeline({
  detailUiBoost,
  localJobStatus,
  hasActiveJob,
  hasPaymentHold,
  allCompleted,
  hasAfterPhotos,
  isJobLister,
  isJobCleaner,
}: JobProgressTimelineProps) {
  const status = localJobStatus ?? "";
  const isDispute =
    status === "disputed" || status === "in_review" || status === "dispute_negotiating";
  const isCompleted = status === "completed";

  const inProgressOrLater =
    status === "in_progress" ||
    status === "completed_pending_approval" ||
    isCompleted ||
    isDispute;

  const fundsReleased = isCompleted;

  const paidStepTitle =
    isCompleted
      ? "Funds released"
      : status === "in_review"
        ? "Bond Back review"
        : status === "dispute_negotiating" || status === "disputed"
          ? "Refund / dispute"
          : "Funds released";

  const paidHintLister =
    isCompleted
      ? "Payment goes to the cleaner after you release from escrow."
      : status === "in_review"
        ? "An admin will decide how escrow is released. Do not use Approve & release — wait for Bond Back’s decision."
        : status === "dispute_negotiating" || status === "disputed"
          ? "Use the dispute section below to negotiate a refund with the cleaner or wait for escalation."
          : status === "completed_pending_approval"
            ? "Review photos, then Approve & release — or open a dispute if needed."
            : "Payment goes to the cleaner after you release from escrow.";

  const paidHintCleaner =
    isCompleted
      ? "Payout goes to your connected account after the lister releases."
      : status === "in_review"
        ? "Bond Back is reviewing. Funds stay in escrow until support decides."
        : status === "dispute_negotiating" || status === "disputed"
          ? "Respond to the lister’s refund request below, or the case may go to Bond Back."
          : status === "completed_pending_approval"
            ? "The lister is reviewing. You’ll be paid when they approve or when the timer ends."
            : "Payout goes to your connected account after the lister releases.";

  const steps: StepDef[] = [
    {
      id: "confirmed",
      title: "Job confirmed",
      done: !!hasActiveJob,
      hintLister: hasPaymentHold
        ? "Funds are in escrow. Tap Start Job when you’re ready."
        : "Tap Pay & Start Job to hold funds in escrow and unlock the checklist.",
      hintCleaner:
        "You’ve won this job. The lister pays to start — then you’ll see the address and checklist.",
    },
    {
      id: "active",
      title: "Work in progress",
      done: inProgressOrLater,
      hintLister:
        "The cleaner will be required to work through a checklist. Coordinate on Messages if needed.",
      hintCleaner:
        "Work through the checklist on this page. Upload photos as you go.",
    },
    {
      id: "checklist",
      title: "Checklist complete",
      done: allCompleted,
      hintLister: "Every task must be ticked before you can approve payment.",
      hintCleaner: "Tick each line when that part of the clean is done.",
    },
    {
      id: "photos",
      title: "After photos uploaded",
      done: hasAfterPhotos,
      hintLister: "You need at least three after photos before releasing funds.",
      hintCleaner: "Upload at least three after photos when the clean is finished.",
    },
    {
      id: "paid",
      title: paidStepTitle,
      done: fundsReleased,
      hintLister: paidHintLister,
      hintCleaner: paidHintCleaner,
    },
  ];

  const doneFlags = steps.map((s) => s.done);
  const firstIncomplete = doneFlags.findIndex((d) => !d);
  const activeIndex = firstIncomplete === -1 ? steps.length - 1 : firstIncomplete;

  const hintFor = (step: StepDef, index: number) => {
    const base = isJobLister ? step.hintLister : isJobCleaner ? step.hintCleaner : step.hintLister;
    const isCurrent = index === activeIndex && !step.done;
    if (step.done) {
      return index === steps.length - 1 && fundsReleased
        ? "Completed."
        : null;
    }
    if (isCurrent) return base;
    return "Not started yet.";
  };

  const statusBadge = () => {
    if (isDispute) {
      return (
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          Dispute
        </span>
      );
    }
    if (status === "accepted" && hasPaymentHold) {
      return (
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          Escrow funded
        </span>
      );
    }
    if (status === "accepted" && !hasPaymentHold) {
      return (
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          Awaiting payment
        </span>
      );
    }
    if (status === "in_progress") {
      return (
        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
          In progress
        </span>
      );
    }
    if (status === "completed_pending_approval") {
      return (
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          Review
        </span>
      );
    }
    if (isCompleted) {
      return (
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          Done
        </span>
      );
    }
    return null;
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-muted/30 px-3 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40",
        detailUiBoost && "sm:px-5 sm:py-5"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p
            className={cn(
              "font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-200",
              detailUiBoost ? "text-xs sm:text-sm" : "text-[11px] sm:text-xs"
            )}
          >
            Job progress
          </p>
          <p className="mt-1 text-xs text-muted-foreground dark:text-gray-400 sm:text-sm">
            {isJobLister && "Your listing — follow these steps."}
            {isJobCleaner && "Your job — work through each stage."}
            {!isJobLister && !isJobCleaner && "Job stages."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{statusBadge()}</div>
      </div>

      <p
        className="mt-3 text-[11px] font-medium tabular-nums text-muted-foreground dark:text-gray-300 sm:hidden"
        aria-live="polite"
      >
        Step {Math.min(activeIndex + 1, steps.length)} of {steps.length}
        {steps[activeIndex]?.done === false && steps[activeIndex] ? (
          <span className="text-foreground dark:text-gray-100"> — {steps[activeIndex].title}</span>
        ) : null}
      </p>

      {isDispute && (
        <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-snug text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
          {status === "in_review"
            ? "This job is with Bond Back for review. Escrow stays on hold until an admin resolves the dispute — details below."
            : "A dispute or refund negotiation is open — work through it below. Progress above shows where the job stood before the dispute."}
        </p>
      )}

      <ol className="relative mt-4 space-y-0 sm:mt-5">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isActive = index === activeIndex && !step.done;
          const isDone = step.done;
          const hintText = hintFor(step, index);

          return (
            <li key={step.id} className="relative flex gap-3 sm:gap-4">
              {/* Timeline rail */}
              <div className="flex w-9 shrink-0 flex-col items-center sm:w-10">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors sm:h-10 sm:w-10 sm:text-sm",
                    isDone &&
                      "border-emerald-500 bg-emerald-500 text-white dark:border-emerald-600 dark:bg-emerald-600",
                    !isDone &&
                      isActive &&
                      "border-primary bg-background text-primary shadow-sm ring-2 ring-primary/20 dark:bg-gray-950",
                    !isDone &&
                      !isActive &&
                      "border-muted-foreground/25 bg-muted/50 text-muted-foreground dark:border-gray-600 dark:bg-gray-800/80"
                  )}
                  aria-hidden
                >
                  {isDone ? (
                    <Check className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={3} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {!isLast && (
                  <span
                    className={cn(
                      "my-0.5 block w-0.5 flex-1 min-h-[14px] sm:min-h-[18px]",
                      isDone
                        ? "bg-emerald-500/70 dark:bg-emerald-600/70"
                        : "bg-border dark:bg-gray-700"
                    )}
                    aria-hidden
                  />
                )}
              </div>

              <div
                className={cn(
                  "min-w-0 flex-1 pb-5 sm:pb-6",
                  isLast && "pb-0"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold leading-tight sm:text-base",
                      isDone && "text-foreground dark:text-gray-100",
                      !isDone && isActive && "text-foreground dark:text-gray-100",
                      !isDone && !isActive && "text-muted-foreground dark:text-gray-500"
                    )}
                  >
                    {step.title}
                  </span>
                  {isActive && !isDone && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary dark:bg-primary/20 dark:text-sky-300">
                      Now
                    </span>
                  )}
                </div>
                {hintText != null && (
                  <p
                    className={cn(
                      "mt-1.5 text-xs leading-relaxed text-muted-foreground dark:text-gray-400 sm:text-[13px] sm:leading-relaxed",
                      isActive && !isDone && "text-foreground/90 dark:text-gray-300"
                    )}
                  >
                    {hintText}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {isCompleted && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 dark:border-emerald-800/50 dark:bg-emerald-950/25">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
            All steps complete. Thanks for using Bond Back.
          </p>
        </div>
      )}
    </div>
  );
}
