export const MAX_CANCELLATION_FEE_CENTS = 5000; // $50 AUD

export function computeNonResponsiveCancellationAmounts(params: {
  agreedAmountCents: number;
  feePercent: number;
}): {
  platformFeeCents: number;
  cancellationFeeCents: number;
  chargeTotalCents: number;
  refundCents: number;
} {
  const agreed = Math.max(0, Math.round(params.agreedAmountCents));
  const pct = params.feePercent / 100;
  const platformFeeCents = Math.round(agreed * pct);
  const cancellationFeeCents = Math.min(MAX_CANCELLATION_FEE_CENTS, platformFeeCents);
  const chargeTotalCents = agreed + platformFeeCents;
  const refundCents = Math.max(0, chargeTotalCents - cancellationFeeCents);
  return { platformFeeCents, cancellationFeeCents, chargeTotalCents, refundCents };
}

export type ListerNonResponsiveCancelPreview =
  | {
      eligible: true;
      cancellationFeeCents: number;
      refundCents: number;
      chargeTotalCents: number;
      platformFeeCents: number;
      platformFeePercent: number;
      idleHours: number;
      requiredIdleDays: number;
    }
  | { eligible: false; reason: string };

/**
 * When true, show the lister "cancel (non-responsive cleaner)" control on the job page.
 * Only after server-side policy passes (e.g. cleaner idle / non-response threshold met).
 */
export function shouldShowListerNonResponsiveCancelControl(
  preview: ListerNonResponsiveCancelPreview
): preview is Extract<ListerNonResponsiveCancelPreview, { eligible: true }> {
  return preview.eligible;
}
