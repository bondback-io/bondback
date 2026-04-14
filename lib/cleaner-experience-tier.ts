/**
 * Public-facing experience labels from completed Bond Back jobs (winner_id, status completed).
 * Highest applicable tier wins: Veteran ≥ Professional ≥ Experienced ≥ New.
 */
export type CleanerExperienceTier = "new" | "experienced" | "professional" | "veteran";

export function cleanerExperienceTierFromJobCount(jobs: number): CleanerExperienceTier {
  const n = Math.max(0, Math.floor(Number(jobs) || 0));
  if (n >= 10) return "veteran";
  if (n >= 5) return "professional";
  if (n >= 1) return "experienced";
  return "new";
}

export const CLEANER_EXPERIENCE_TIER_META: Record<
  CleanerExperienceTier,
  { label: string; badgeClassName: string }
> = {
  new: {
    label: "New Cleaner",
    badgeClassName:
      "border border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  experienced: {
    label: "Experienced Cleaner",
    badgeClassName:
      "border border-sky-500/45 bg-sky-500/15 text-sky-900 dark:border-sky-500/40 dark:bg-sky-950/55 dark:text-sky-200",
  },
  professional: {
    label: "Professional Cleaner",
    badgeClassName:
      "border border-violet-500/45 bg-violet-500/15 text-violet-900 dark:border-violet-500/40 dark:bg-violet-950/55 dark:text-violet-200",
  },
  veteran: {
    label: "Veteran Cleaner",
    badgeClassName:
      "border border-amber-500/50 bg-amber-500/20 text-amber-950 dark:border-amber-500/45 dark:bg-amber-950/60 dark:text-amber-100",
  },
};

export function cleanerExperienceBadgeClassName(jobs: number): string {
  const tier = cleanerExperienceTierFromJobCount(jobs);
  return CLEANER_EXPERIENCE_TIER_META[tier].badgeClassName;
}

export function cleanerExperienceLabel(jobs: number): string {
  const tier = cleanerExperienceTierFromJobCount(jobs);
  return CLEANER_EXPERIENCE_TIER_META[tier].label;
}
