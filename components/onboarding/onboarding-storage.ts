/**
 * Client-only localStorage keys and helpers for pre-auth onboarding flow.
 */

export const ONBOARDING_ROLE_KEY = "bondback_onboarding_role";
export const ONBOARDING_DETAILS_KEY = "bondback_onboarding_details";
/** Main `/signup` flow: name + postcode before email confirm (synced on role-choice or complete-profile). */
export const PENDING_MINIMAL_PROFILE_KEY = "bondback_pending_minimal_profile";
/** Referral code from ?ref= (stored before signup). */
export const ONBOARDING_REFERRAL_KEY = "bondback_referral_code";

export type OnboardingRole = "lister" | "cleaner" | "both";

export type OnboardingDetails = {
  full_name: string;
  phone: string;
  state: string;
  suburb: string;
  postcode: string;
  abn: string;
};

export function setOnboardingRole(role: OnboardingRole): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ONBOARDING_ROLE_KEY, role);
  }
}

export function getOnboardingRole(): OnboardingRole | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(ONBOARDING_ROLE_KEY);
  if (v === "lister" || v === "cleaner" || v === "both") return v;
  return null;
}

export function setOnboardingDetails(details: OnboardingDetails): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ONBOARDING_DETAILS_KEY, JSON.stringify(details));
  }
}

export function getOnboardingDetails(): OnboardingDetails | null {
  if (typeof window === "undefined") return null;
  try {
    const s = window.localStorage.getItem(ONBOARDING_DETAILS_KEY);
    if (!s) return null;
    const d = JSON.parse(s) as OnboardingDetails;
    if (d && typeof d.full_name === "string" && typeof d.phone === "string") return d;
  } catch {
    // ignore
  }
  return null;
}

export function clearOnboarding(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ONBOARDING_ROLE_KEY);
    window.localStorage.removeItem(ONBOARDING_DETAILS_KEY);
    window.localStorage.removeItem(ONBOARDING_REFERRAL_KEY);
  }
}

/** Save referral code from landing URL (?ref=XXXX). */
export function setPendingReferralCode(code: string | null | undefined): void {
  if (typeof window === "undefined" || !code?.trim()) return;
  window.localStorage.setItem(ONBOARDING_REFERRAL_KEY, code.trim().toUpperCase());
}

export function getPendingReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(ONBOARDING_REFERRAL_KEY);
  return v?.trim() ? v.trim().toUpperCase() : null;
}
