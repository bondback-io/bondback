import {
  normalizeVerificationBadges,
  type VerificationBadgeType,
} from "@/lib/verification-badges";

export type CleanerBrowseTier = "elite" | "pro" | "rising";

export type CleanerTierInput = {
  completedJobs: number;
  avgRating: number | null;
  reviewCount: number;
  badges: string[] | null | undefined;
  hasAbn: boolean;
  hasInsurance: boolean;
  portfolioPhotoCount: number;
};

function hasTrustedBadge(badges: string[] | null | undefined): boolean {
  return normalizeVerificationBadges(badges).includes(
    "trusted_cleaner" as VerificationBadgeType
  );
}

/**
 * Three public tiers for browse UI — combines platform badges, job history,
 * ratings, and profile completeness (ABN, insurance, portfolio).
 */
export function computeCleanerBrowseTier(input: CleanerTierInput): CleanerBrowseTier {
  const {
    completedJobs,
    avgRating,
    reviewCount,
    badges,
    hasAbn,
    hasInsurance,
    portfolioPhotoCount,
  } = input;

  const trusted = hasTrustedBadge(badges);
  const rating = avgRating != null && Number.isFinite(avgRating) ? avgRating : null;
  const reviews = Math.max(0, reviewCount);

  if (trusted) return "elite";

  if (completedJobs >= 10 && rating != null && rating >= 4.5) return "elite";

  if (
    completedJobs >= 5 &&
    hasAbn &&
    hasInsurance &&
    rating != null &&
    rating >= 4 &&
    reviews >= 3
  ) {
    return "elite";
  }

  if (completedJobs >= 3) return "pro";

  if (hasAbn && rating != null && rating >= 4 && reviews >= 2) return "pro";

  if (completedJobs >= 1 && hasAbn && hasInsurance) return "pro";

  if (hasAbn && rating != null && rating >= 4.5 && reviews >= 1) return "pro";

  if (portfolioPhotoCount >= 3 && hasAbn && completedJobs >= 1) return "pro";

  return "rising";
}

export function tierSortRank(tier: CleanerBrowseTier): number {
  switch (tier) {
    case "elite":
      return 0;
    case "pro":
      return 1;
    default:
      return 2;
  }
}

export const CLEANER_TIER_META: Record<
  CleanerBrowseTier,
  { label: string; short: string; className: string; ringClass: string }
> = {
  elite: {
    label: "Elite cleaner",
    short: "Elite",
    className:
      "border-amber-300/90 bg-gradient-to-br from-amber-50 to-amber-100/90 text-amber-950 dark:border-amber-600/80 dark:from-amber-950/80 dark:to-amber-900/50 dark:text-amber-50",
    ringClass: "ring-amber-400/35 dark:ring-amber-500/30",
  },
  pro: {
    label: "Pro cleaner",
    short: "Pro",
    className:
      "border-emerald-300/90 bg-gradient-to-br from-emerald-50 to-teal-50/90 text-emerald-950 dark:border-emerald-600/70 dark:from-emerald-950/70 dark:to-teal-950/40 dark:text-emerald-50",
    ringClass: "ring-emerald-400/30 dark:ring-emerald-500/25",
  },
  rising: {
    label: "Rising cleaner",
    short: "Rising",
    className:
      "border-sky-300/90 bg-gradient-to-br from-sky-50 to-slate-50/80 text-sky-950 dark:border-sky-700/60 dark:from-sky-950/50 dark:to-slate-900/50 dark:text-sky-50",
    ringClass: "ring-sky-400/25 dark:ring-sky-500/20",
  },
};
