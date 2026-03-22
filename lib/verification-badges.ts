export type VerificationBadgeType =
  | "abn_verified"
  | "email_verified"
  | "trusted_cleaner"
  | "verified_lister";

export const VERIFICATION_BADGE_META: Record<
  VerificationBadgeType,
  { label: string; tooltip: string; toneClassName: string }
> = {
  abn_verified: {
    label: "ABN Verified",
    tooltip: "ABN Verified - confirmed active by ABR",
    toneClassName:
      "border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
  },
  email_verified: {
    label: "Email Verified",
    tooltip: "Email Verified - confirmed through account verification",
    toneClassName:
      "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  trusted_cleaner: {
    label: "Trusted Cleaner",
    tooltip: "Trusted Cleaner - 10+ completed jobs and 4.5+ rating",
    toneClassName:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  verified_lister: {
    label: "Verified Lister",
    tooltip: "Verified Lister - 5+ completed jobs without disputes",
    toneClassName:
      "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  },
};

export function normalizeVerificationBadges(input: unknown): VerificationBadgeType[] {
  const arr = Array.isArray(input) ? input : [];
  const out: VerificationBadgeType[] = [];
  for (const raw of arr) {
    const value = String(raw ?? "").trim().toLowerCase() as VerificationBadgeType;
    if (value in VERIFICATION_BADGE_META && !out.includes(value)) out.push(value);
  }
  return out;
}

