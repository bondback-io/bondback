/** Instant payout fee: 1% of amount, minimum $1 AUD (100 cents). Used for display only. */
const INSTANT_PAYOUT_FEE_PERCENT = 1;
const INSTANT_PAYOUT_FEE_MIN_CENTS_AUD = 100;

/** Estimated instant payout fee in cents (1% of amount, min $1 AUD). */
export function estimateInstantPayoutFeeCents(amountCents: number): number {
  const fee = Math.round((amountCents * INSTANT_PAYOUT_FEE_PERCENT) / 100);
  return Math.max(INSTANT_PAYOUT_FEE_MIN_CENTS_AUD, fee);
}
