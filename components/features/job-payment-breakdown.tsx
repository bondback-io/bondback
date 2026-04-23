"use client";

import { Fragment } from "react";
import { formatCents } from "@/lib/listings";
import type { JobTopUpPaymentRecord } from "@/lib/job-top-up";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export type JobPaymentBreakdownProps = {
  agreedAmountCents: number;
  /** Platform fee % (e.g. 12 = 12%). */
  feePercentage: number;
  isStripeTestMode?: boolean;
  /** Short note under the table */
  variant?: "pay" | "release";
  /** Extra escrow holds after Pay & Start — each row is one Stripe Checkout top-up. */
  topUpPayments?: JobTopUpPaymentRecord[];
};

/**
 * Lister-facing fee summary: job price, optional top-up line(s), platform fees, total charged.
 */
export function JobPaymentBreakdown({
  agreedAmountCents,
  feePercentage,
  isStripeTestMode = false,
  variant = "pay",
  topUpPayments = [],
}: JobPaymentBreakdownProps) {
  if (agreedAmountCents < 1) return null;

  const topUps = topUpPayments ?? [];
  const topUpSumAgreed = topUps.reduce((s, t) => s + t.agreed_cents, 0);
  const primaryAgreedCents = agreedAmountCents - topUpSumAgreed;
  const showTopUpRows = topUps.length > 0 && primaryAgreedCents >= 1;

  const feeOnPrimary = Math.max(
    0,
    Math.round((Math.max(0, primaryAgreedCents) * feePercentage) / 100)
  );

  const feeForTopUp = (t: JobTopUpPaymentRecord) => {
    if (t.fee_cents != null && t.fee_cents > 0) return t.fee_cents;
    return Math.round((t.agreed_cents * feePercentage) / 100);
  };

  const totalPlatformFeeCents = showTopUpRows
    ? feeOnPrimary + topUps.reduce((s, t) => s + feeForTopUp(t), 0)
    : Math.round((agreedAmountCents * feePercentage) / 100);

  const totalChargedCents = agreedAmountCents + totalPlatformFeeCents;

  const howItWorks =
    variant === "pay"
      ? "Funds are authorized with manual capture — nothing is paid out to the cleaner until you approve release or the auto-release timer ends."
      : "On release, Stripe captures the hold, then the agreed job amount is transferred to the cleaner’s connected account (the Service Fee was included in your total).";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-xl border border-border/80 bg-muted/40 px-3 py-3 sm:px-4 dark:border-gray-700 dark:bg-gray-900/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight text-foreground dark:text-gray-100">
              Payment
            </p>
            {isStripeTestMode && (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Test mode
              </p>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="How this payment works"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="end"
              className="max-w-[min(92vw,18rem)] text-xs leading-snug"
            >
              {howItWorks}
            </TooltipContent>
          </Tooltip>
        </div>

        {showTopUpRows ? (
          <>
            <div
              className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1.5 text-xs sm:text-sm"
              role="table"
            >
              <div className="border-b border-border pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-gray-700 dark:text-gray-500 sm:text-[11px]">
                Line
              </div>
              <div className="border-b border-border pb-1 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-gray-700 dark:text-gray-500 sm:text-[11px]">
                To cleaner
              </div>
              <div className="border-b border-border pb-1 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-gray-700 dark:text-gray-500 sm:text-[11px]">
                Service Fee ({feePercentage}%)
              </div>
              <div className="text-muted-foreground dark:text-gray-400">Agreed job price</div>
              <div className="text-right tabular-nums font-medium text-foreground dark:text-gray-100">
                {formatCents(primaryAgreedCents)}
              </div>
              <div className="text-right tabular-nums font-medium text-foreground dark:text-gray-100">
                {formatCents(feeOnPrimary)}
              </div>
              {topUps.map((t, i) => (
                <Fragment key={`${t.payment_intent_id}-${i}`}>
                  <div className="text-muted-foreground dark:text-gray-400">
                    Top-up amount
                    {topUps.length > 1 ? ` (${i + 1})` : ""}
                  </div>
                  <div className="text-right tabular-nums font-medium text-foreground dark:text-gray-100">
                    {formatCents(t.agreed_cents)}
                  </div>
                  <div className="text-right tabular-nums font-medium text-foreground dark:text-gray-100">
                    {formatCents(feeForTopUp(t))}
                  </div>
                </Fragment>
              ))}
              <div className="col-span-3 mt-1 border-t border-border pt-2 dark:border-gray-700" />
              <div className="font-semibold text-foreground dark:text-gray-100">Agreed job total</div>
              <div className="text-right tabular-nums font-semibold text-foreground dark:text-gray-100">
                {formatCents(agreedAmountCents)}
              </div>
              <div className="text-right tabular-nums font-semibold text-foreground dark:text-gray-100">
                {formatCents(totalPlatformFeeCents)}
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-2 dark:border-gray-700">
              <span className="text-sm font-semibold text-foreground dark:text-gray-100">
                Total charged (job + Service Fees)
              </span>
              <span className="shrink-0 tabular-nums text-base font-semibold text-foreground dark:text-gray-100">
                {formatCents(totalChargedCents)}
              </span>
            </div>
          </>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground dark:text-gray-400">Job price</dt>
              <dd className="shrink-0 tabular-nums font-medium text-foreground dark:text-gray-100">
                {formatCents(agreedAmountCents)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="flex min-w-0 items-center gap-1 text-muted-foreground dark:text-gray-400">
                <span className="truncate">Service Fee ({feePercentage}%)</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex shrink-0 cursor-help rounded p-0.5 opacity-80 hover:opacity-100"
                      aria-label="Service Fee info"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Paid on top of the job price. Covers secure payments, disputes, and running Bond Back.
                  </TooltipContent>
                </Tooltip>
              </dt>
              <dd className="shrink-0 tabular-nums font-medium text-foreground dark:text-gray-100">
                {formatCents(totalPlatformFeeCents)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2 dark:border-gray-700">
              <dt className="font-semibold text-foreground dark:text-gray-100">Total</dt>
              <dd className="shrink-0 tabular-nums font-semibold text-foreground dark:text-gray-100">
                {formatCents(totalChargedCents)}
              </dd>
            </div>
          </dl>
        )}

        <p className="mt-2 text-[10px] leading-snug text-muted-foreground dark:text-gray-500 sm:text-xs">
          {variant === "pay"
            ? "Authorize and hold until you release."
            : "Release sends the job amount to your cleaner."}
        </p>
      </div>
    </TooltipProvider>
  );
}
