"use client";

import { format } from "date-fns";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, CreditCard, RefreshCw, PlusCircle, Scale } from "lucide-react";
import type { JobTopUpPaymentRecord } from "@/lib/job-top-up";

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
  /** Total amount held in escrow in cents (when hasPaymentHold); usually equals agreed job total. */
  heldAmountCents?: number | null;
  /** When payment was released to cleaner (captured + transferred). */
  paymentReleasedAt: string | null;
  /** Dispute resolution type if resolved (e.g. partial_refund_accepted, admin_mediation_final). */
  disputeResolution: string | null;
  /** When dispute was resolved (or lister escrow cancel time when that path sets it). */
  resolutionAt: string | null;
  /** Refund amount in cents from job escrow to the lister (if any). */
  refundAmountCents: number | null;
  /** Additional escrow payments (separate PaymentIntents). */
  topUpPayments?: JobTopUpPaymentRecord[];
  /** Total agreed job price in cents (includes top-ups); defaults to held amount when omitted. */
  totalAgreedCents?: number | null;
  /** Net cents from job escrow paid to the cleaner after any lister refund. */
  netToCleanerCents?: number | null;
  /** When the job had a dispute case — link to hub detail for audit trail. */
  disputeCaseHref?: string | null;
  /** `lister_escrow_cancel_reason` when lister cancelled after escrow (e.g. non-responsive cleaner). */
  listerEscrowCancelReasonCode?: string | null;
  /**
   * True when job was cancelled with lister refund and no payment release to cleaner.
   * Swaps the summary for clearer copy vs “final to cleaner”.
   */
  isCancelledWithListerEscrowRefund?: boolean;
  /**
   * Cleaner-only: Bond Back promo bonus cents (`jobs.cleaner_bonus_cents_applied`), funded from the platform fee.
   * Omit or null so listers do not see this line.
   */
  cleanerPromoBonusCents?: number | null;
};

type TimelineStep = {
  label: string;
  sublabel?: string;
  date: string | null;
  icon: React.ReactNode;
  done: boolean;
};

export function JobPaymentTimeline({
  hasPaymentHold,
  heldAmountCents = null,
  paymentReleasedAt,
  disputeResolution,
  resolutionAt,
  refundAmountCents,
  topUpPayments = [],
  totalAgreedCents = null,
  netToCleanerCents = null,
  disputeCaseHref = null,
  listerEscrowCancelReasonCode = null,
  isCancelledWithListerEscrowRefund = false,
  cleanerPromoBonusCents = null,
}: JobPaymentTimelineProps) {
  const topUps = topUpPayments ?? [];
  const totalAgreed =
    totalAgreedCents != null && totalAgreedCents > 0
      ? totalAgreedCents
      : heldAmountCents != null && heldAmountCents > 0
        ? heldAmountCents
        : 0;
  const topSum = topUps.reduce((s, t) => s + t.agreed_cents, 0);
  const primaryCents = Math.max(0, totalAgreed - topSum);

  const refundCents =
    refundAmountCents != null && refundAmountCents > 0
      ? Math.round(refundAmountCents)
      : null;
  const refundEventAt = resolutionAt?.trim() || paymentReleasedAt?.trim() || null;
  const showRefundStep = refundCents != null && Boolean(refundEventAt);

  function listerCancelRefundSublabel(): string | undefined {
    const c = (listerEscrowCancelReasonCode ?? "").trim();
    if (c === "cleaner_non_responsive_escrow_cancel") {
      return "Lister cancel — cleaner treated as non-responsive; funds returned per policy";
    }
    if (c.length > 0) {
      return `Reason: ${c.replace(/_/g, " ")}`;
    }
    return "From escrow to lister (job cancelled)";
  }

  /** Prefer escrow total minus refund whenever a refund is shown — matches the timeline line items. */
  const netReleased =
    totalAgreed > 0 && refundCents != null
      ? Math.max(0, totalAgreed - refundCents)
      : netToCleanerCents != null && netToCleanerCents >= 0
        ? netToCleanerCents
        : totalAgreed > 0
          ? totalAgreed
          : null;

  const steps: TimelineStep[] = [];

  if (hasPaymentHold && totalAgreed > 0) {
    if (topUps.length === 0) {
      steps.push({
        label: "Payment held",
        sublabel: `${formatCents(totalAgreed)} in escrow`,
        date: null,
        icon: <CreditCard className="h-4 w-4" />,
        done: true,
      });
    } else {
      if (primaryCents >= 1) {
        steps.push({
          label: "Initial escrow hold",
          sublabel: `${formatCents(primaryCents)} from the first payment`,
          date: null,
          icon: <CreditCard className="h-4 w-4" />,
          done: true,
        });
      }
      topUps.forEach((t, idx) => {
        const note = t.note?.trim();
        const noteShort =
          note && note.length > 0
            ? note.length > 72
              ? `${note.slice(0, 72)}…`
              : note
            : null;
        steps.push({
          label:
            topUps.length > 1
              ? `Additional payment #${idx + 1}`
              : "Additional payment (top-up)",
          sublabel: [
            `${formatCents(t.agreed_cents)} added to escrow`,
            noteShort,
          ]
            .filter(Boolean)
            .join(" · "),
          date: t.created_at?.trim() ? t.created_at : null,
          icon: <PlusCircle className="h-4 w-4 text-sky-600 dark:text-sky-400" />,
          done: true,
        });
      });
    }
  }

  if (showRefundStep && refundCents != null && refundEventAt) {
    steps.push({
      label: `Refund to lister — ${formatCents(refundCents)}`,
      sublabel: disputeResolution?.trim()
        ? `Recorded as: ${disputeResolution.replace(/_/g, " ")}`
        : isCancelledWithListerEscrowRefund
          ? listerCancelRefundSublabel()
          : "From job escrow",
      date: refundEventAt,
      icon: <RefreshCw className="h-4 w-4 text-amber-600" />,
      done: true,
    });
  }

  if (paymentReleasedAt) {
    steps.push({
      label: "Released to cleaner",
      sublabel:
        netReleased != null && netReleased >= 0
          ? refundCents != null
            ? `${formatCents(netReleased)} to cleaner after ${formatCents(refundCents)} refund`
            : `${formatCents(netReleased)} job payment from escrow`
          : undefined,
      date: paymentReleasedAt,
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      done: true,
    });
  }

  if (steps.length === 0) return null;

  const showSummary =
    totalAgreed > 0 &&
    (refundCents != null || topUps.length > 0 || netReleased != null);
  const listerCancelSummary =
    isCancelledWithListerEscrowRefund && refundCents != null && refundCents > 0 && Boolean(refundEventAt);

  return (
    <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold dark:text-gray-100">
          Transaction timeline
        </CardTitle>
        <p className="text-xs text-muted-foreground dark:text-gray-400">
          Payment and payout events for this job.
        </p>
        {listerCancelSummary ? (
          <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
            <span className="font-semibold">Job cancelled after escrow.</span>{" "}
            {formatCents(refundCents!)} was refunded to the lister
            {refundEventAt ? (
              <> (recorded {format(new Date(refundEventAt), "d MMM yyyy, HH:mm")})</>
            ) : null}
            . No payout was released to the cleaner.
          </p>
        ) : showSummary && netReleased != null && netReleased >= 0 ? (
          <p className="mt-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200">
            <span className="font-semibold">Final job price (escrow to cleaner):</span>{" "}
            {formatCents(netReleased)}
            {totalAgreed > netReleased ? (
              <>
                {" "}
                — total held for the job was {formatCents(totalAgreed)}
                {refundCents != null ? (
                  <>
                    , including {formatCents(refundCents)} refunded to the lister
                  </>
                ) : null}
                .
              </>
            ) : (
              "."
            )}
          </p>
        ) : null}
        {cleanerPromoBonusCents != null && cleanerPromoBonusCents >= 1 ? (
          <p className="mt-2 rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-xs leading-relaxed text-emerald-950 dark:border-emerald-800/55 dark:bg-emerald-950/35 dark:text-emerald-100">
            <span className="font-semibold">Bond Back promo bonus:</span>{" "}
            {formatCents(cleanerPromoBonusCents)} funded from the platform service fee when payment was released
            (not added to what the lister paid — your payout includes this).
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
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

        {disputeCaseHref?.trim() ? (
          <div className="flex gap-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:border-amber-800/55 dark:bg-amber-950/35 dark:text-amber-100">
            <Scale className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="min-w-0">
              This job was disputed.{" "}
              <Link
                href={disputeCaseHref}
                className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50"
              >
                View the closed dispute case
              </Link>{" "}
              for messages and decisions.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
