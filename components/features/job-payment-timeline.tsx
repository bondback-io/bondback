"use client";

import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, CreditCard, RefreshCw } from "lucide-react";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export type JobPaymentTimelineProps = {
  /** Whether the job has a payment hold (PaymentIntent). */
  hasPaymentHold: boolean;
  /** Amount held in escrow in cents (when hasPaymentHold). */
  heldAmountCents?: number | null;
  /** When payment was released to cleaner (captured + transferred). */
  paymentReleasedAt: string | null;
  /** Dispute resolution type if resolved (e.g. partial_refund_accepted, refund). */
  disputeResolution: string | null;
  /** When dispute was resolved. */
  resolutionAt: string | null;
  /** Refund amount in cents (if any). */
  refundAmountCents: number | null;
};

export function JobPaymentTimeline({
  hasPaymentHold,
  heldAmountCents = null,
  paymentReleasedAt,
  disputeResolution,
  resolutionAt,
  refundAmountCents,
}: JobPaymentTimelineProps) {
  const hasRefund =
    disputeResolution &&
    (disputeResolution === "partial_refund_accepted" ||
      disputeResolution === "counter_accepted_by_lister" ||
      disputeResolution === "refund") &&
    resolutionAt;

  const steps: { label: string; sublabel?: string; date: string | null; icon: React.ReactNode; done: boolean }[] = [];

  if (hasPaymentHold) {
    steps.push({
      label: "Payment held",
      sublabel: heldAmountCents != null && heldAmountCents > 0
        ? `${formatCents(heldAmountCents)} in escrow`
        : undefined,
      date: null,
      icon: <CreditCard className="h-4 w-4" />,
      done: true,
    });
  }

  if (paymentReleasedAt) {
    steps.push({
      label: "Released to cleaner",
      date: paymentReleasedAt,
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      done: true,
    });
  }

  if (hasRefund && refundAmountCents != null && refundAmountCents > 0) {
    steps.push({
      label: `Refund of ${formatCents(refundAmountCents)} to lister`,
      date: resolutionAt,
      icon: <RefreshCw className="h-4 w-4 text-amber-600" />,
      done: true,
    });
  }

  if (steps.length === 0) return null;

  return (
    <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold dark:text-gray-100">
          Transaction timeline
        </CardTitle>
        <p className="text-xs text-muted-foreground dark:text-gray-400">
          Payment and payout events for this job.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {steps.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-sm"
            >
              <span
                className={
                  step.done
                    ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-gray-800 dark:text-gray-300"
                    : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border dark:border-gray-700"
                }
              >
                {step.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground dark:text-gray-100">
                  {step.label}
                </p>
                {step.sublabel && (
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    {step.sublabel}
                  </p>
                )}
                {step.date && (
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    {format(new Date(step.date), "d MMM yyyy, HH:mm")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
