"use client";

import { formatCents } from "@/lib/listings";
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
};

/**
 * Lister-facing fee breakdown: job price, platform fee, total charged, and cleaner payout (agreed amount).
 * Fee is calculated on the job price; the lister pays job + fee; the cleaner is transferred the agreed job amount (Stripe Connect `stripe_connect_id`).
 */
export function JobPaymentBreakdown({
  agreedAmountCents,
  feePercentage,
  isStripeTestMode = false,
  variant = "pay",
}: JobPaymentBreakdownProps) {
  if (agreedAmountCents < 1) return null;

  const feeCents = Math.round((agreedAmountCents * feePercentage) / 100);
  const totalChargedCents = agreedAmountCents + feeCents;

  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
      <p className="mb-1 font-medium dark:text-gray-100">Payment breakdown</p>
      {isStripeTestMode && (
        <p className="mb-2 text-[11px] font-medium text-amber-800 dark:text-amber-200">
          TEST MODE
        </p>
      )}
      <div className="space-y-1 text-[11px] sm:text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground dark:text-gray-400">Job price (escrow / cleaner payout):</span>
          <span className="min-w-[4.5rem] text-right font-medium tabular-nums dark:text-gray-100">
            {formatCents(agreedAmountCents)}
          </span>
        </div>
        <div className="flex justify-between gap-4 items-center">
          <span className="text-muted-foreground dark:text-gray-400">
            Platform fee ({feePercentage}%):
          </span>
          <span className="flex min-w-[4.5rem] justify-end items-center gap-0.5 font-medium tabular-nums dark:text-gray-100">
            {formatCents(feeCents)}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex cursor-help rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Platform fee info"
                  >
                    <Info className="h-3.5 w-3.5 shrink-0" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  Paid by the lister on top of the job price. Covers secure payments, disputes, and running Bond Back.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-1.5 mt-1 font-semibold dark:border-gray-700 dark:text-gray-100">
          <span>Total charged (held in escrow):</span>
          <span className="min-w-[4.5rem] text-right tabular-nums">
            {formatCents(totalChargedCents)}
          </span>
        </div>
        <p className="border-t border-border pt-1.5 text-[10px] leading-snug text-muted-foreground dark:border-gray-700 dark:text-gray-500">
          {variant === "pay"
            ? "Funds are authorized with manual capture — nothing is paid out to the cleaner until you approve release or the auto-release timer ends."
            : "On release, Stripe captures the hold, then the agreed job amount is transferred to the cleaner’s connected account (minus nothing from their share; the fee was part of your total)."}
        </p>
      </div>
    </div>
  );
}
