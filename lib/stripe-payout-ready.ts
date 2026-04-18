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
