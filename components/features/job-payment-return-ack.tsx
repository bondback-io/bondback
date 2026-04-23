"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { scheduleRouterAction } from "@/lib/deferred-router";

function formatAudFromCents(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export type PaymentNotice = "success" | "top_up_success" | "error" | "canceled" | null;

export type JobPaymentReturnAckProps = {
  notice: PaymentNotice;
  agreedAmountCents: number;
  feePercentage: number;
  isStripeTestMode: boolean;
};

/**
 * Shown after Stripe Checkout return (?payment_notice=…). Strips query params on dismiss so
 * refresh does not repeat the message. Replaces duplicate client-side fulfillment + router.refresh.
 */
export function JobPaymentReturnAck({
  notice,
  agreedAmountCents,
  feePercentage,
  isStripeTestMode,
}: JobPaymentReturnAckProps) {
  const router = useRouter();
  const pathname = usePathname();

  const stripQuery = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}${window.location.hash ?? ""}`
      );
    }
    scheduleRouterAction(() => router.replace(pathname, { scroll: false }));
  }, [router, pathname]);

  if (!notice) return null;

  const jobAmount = formatAudFromCents(agreedAmountCents);
  const feeCents = Math.round((agreedAmountCents * feePercentage) / 100);
  const feeAmount = formatAudFromCents(feeCents);

  if (notice === "success") {
    return (
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) stripQuery();
        }}
      >
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment received</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-left text-sm text-muted-foreground">
                {isStripeTestMode && (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-950 dark:text-amber-100">
                    Test mode — no real charge was processed.
                  </p>
                )}
                <p>
                  Your payment succeeded. The checkout total included the agreed job amount (
                  {jobAmount}) and the Service Fee ({feePercentage}% · {feeAmount}).
                </p>
                <p>
                  The <strong className="text-foreground">{jobAmount}</strong> agreed for the bond
                  clean is <strong className="text-foreground">held in escrow</strong> for this job.
                  The Service Fee is separate and covers Bond Back&apos;s service; it is not part of
                  the cleaner&apos;s payout when you release funds.
                </p>
                <p className="text-muted-foreground">
                  The cleaner can proceed — you don&apos;t need to pay again to start the job.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button type="button" onClick={stripQuery} className="w-full sm:w-auto">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (notice === "top_up_success") {
    return (
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) stripQuery();
        }}
      >
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Top-up received</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-left text-sm text-muted-foreground">
                {isStripeTestMode && (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-950 dark:text-amber-100">
                    Test mode — no real charge was processed.
                  </p>
                )}
                <p>
                  Your top-up payment succeeded. This was a <strong className="text-foreground">new</strong>{" "}
                  charge (separate from your original Pay &amp; Start payment). The job portion you added is{" "}
                  <strong className="text-foreground">held in escrow</strong> with your existing hold until you
                  finalize and release funds.
                </p>
                <p>
                  The agreed job total on this page is now <strong className="text-foreground">{jobAmount}</strong>{" "}
                  (including the top-up). The Service Fee on the top-up is separate from the cleaner&apos;s payout.
                </p>
                <p className="text-muted-foreground">
                  The cleaner has been notified that extra funds are available for additional agreed work.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button type="button" onClick={stripQuery} className="w-full sm:w-auto">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (notice === "error") {
    return (
      <Alert variant="destructive" className="text-sm">
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            We could not confirm your payment from Stripe. If a charge appears on your card,
            contact support with your checkout session details.
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={stripQuery} className="shrink-0">
            Dismiss
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="warning" className="text-sm">
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>Payment was canceled. You can try again when you are ready.</span>
        <Button type="button" variant="secondary" size="sm" onClick={stripQuery} className="shrink-0">
          Dismiss
        </Button>
      </AlertDescription>
    </Alert>
  );
}
