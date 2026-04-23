import { trimStr } from "@/lib/utils";

/** True when the profile can receive Connect transfers (account linked + onboarding complete). */
export function isProfileStripePayoutReady(
  profile:
    | {
        stripe_connect_id?: string | null;
        stripe_onboarding_complete?: boolean | null;
      }
    | null
    | undefined
): boolean {
  if (!profile) return false;
  return trimStr(profile.stripe_connect_id).length > 0 && profile.stripe_onboarding_complete === true;
}

const STRIPE_RELEASE_BLOCK_MARKERS = [
  "not finished Stripe payout setup",
  "not connected a bank account (Stripe Connect)",
  "Stripe account is not ready to receive this payout",
  "payout account is still being verified by Stripe",
  "cannot receive payouts yet",
  "Transfers were just requested on the cleaner",
] as const;

/**
 * True when `releaseJobFunds` failed because the winning cleaner must finish Stripe Connect / payout verification.
 */
export function isCleanerStripeReleaseBlockingError(error: string | undefined | null): boolean {
  if (!error || typeof error !== "string") return false;
  const lower = error.trim().toLowerCase();
  if (!lower) return false;
  return STRIPE_RELEASE_BLOCK_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}
