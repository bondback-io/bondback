import {
  normalizeVerificationBadges,
  type VerificationBadgeType,
} from "@/lib/verification-badges";

export type CleanerBrowseTier =
  | "new"
  | "experienced"
  | "professional"
  | "veteran";

/** Legend / sort order — lowest → highest */
export const CLEANER_TIER_ORDER: CleanerBrowseTier[] = [
  "new",
  "experienced",
  "professional",
  "veteran",
];

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
 * Public status levels for browse + profiles — combines completed jobs, average rating,
 * verification badges, and profile completeness (ABN, insurance, portfolio).
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

  // Veteran — strongest history (formerly “elite” tier)
  if (trusted) return "veteran";
  if (completedJobs >= 10 && rating != null && rating >= 4.5) return "veteran";
  if (
    completedJobs >= 5 &&
    hasAbn &&
    hasInsurance &&
    rating != null &&
    rating >= 4 &&
    reviews >= 3
  ) {
    return "veteran";
  }

  // Professional — solid track record (formerly “pro”)
  if (completedJobs >= 3) return "professional";
  if (hasAbn && rating != null && rating >= 4 && reviews >= 2) return "professional";
  if (completedJobs >= 1 && hasAbn && hasInsurance) return "professional";
  if (hasAbn && rating != null && rating >= 4.5 && reviews >= 1) return "professional";
  if (portfolioPhotoCount >= 3 && hasAbn && completedJobs >= 1) return "professional";

  // Experienced — first completed work
  if (completedJobs >= 1) return "experienced";

  return "new";
}

export function tierSortRank(tier: CleanerBrowseTier): number {
  switch (tier) {
    case "veteran":
      return 0;
    case "professional":
      return 1;
    case "experienced":
      return 2;
    default:
      return 3;
  }
}

export const CLEANER_TIER_META: Record<
  CleanerBrowseTier,
  {
    /** Screen reader + tooltip title */
    label: string;
    /** Short chip text (cards / narrow layouts) */
    chipLabel: string;
    /** Subtle styling — avoid loud gradients on mobile overview */
    className: string;
    cardRingClass: string;
    /** Explains jobs + ratings (tooltip / help) */
    tooltip: string;
  }
> = {
  new: {
    label: "New cleaner",
    chipLabel: "New",
    className:
      "border-border/60 bg-muted/50 text-foreground/85 dark:border-gray-700/80 dark:bg-gray-900/55 dark:text-gray-300",
    cardRingClass: "ring-border/25 dark:ring-gray-800/50",
    tooltip:
      "Early on Bond Back or limited completed jobs so far. Levels move up with completed jobs and maintaining a strong average rating (plus verification and profile signals).",
  },
  experienced: {
    label: "Experienced cleaner",
    chipLabel: "Experienced",
    className:
      "border-border/60 bg-muted/60 text-foreground/90 dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-gray-200",
    cardRingClass: "ring-slate-400/15 dark:ring-slate-600/25",
    tooltip:
      "Has completed paid work on the platform. Further levels reward more jobs alongside solid average ratings and trust signals.",
  },
  professional: {
    label: "Professional cleaner",
    chipLabel: "Pro",
    className:
      "border-emerald-600/25 bg-emerald-950/20 text-emerald-100/95 dark:border-emerald-800/50 dark:bg-emerald-950/35 dark:text-emerald-100",
    cardRingClass: "ring-emerald-500/12 dark:ring-emerald-800/30",
    tooltip:
      "Solid job history and profile strength — often multiple completed jobs and good ratings, or strong verification (ABN, insurance) and reviews.",
  },
  veteran: {
    label: "Veteran cleaner",
    chipLabel: "Veteran",
    className:
      "border-amber-600/30 bg-amber-950/25 text-amber-50/95 dark:border-amber-800/45 dark:bg-amber-950/40 dark:text-amber-50",
    cardRingClass: "ring-amber-500/12 dark:ring-amber-900/25",
    tooltip:
      "Lots of completed work and high ratings, or top platform trust (e.g. Trusted badge). The bar is jobs plus keeping averages strong.",
  },
};
