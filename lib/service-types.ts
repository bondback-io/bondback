/**
 * Marketplace service types (listings.service_type) + UI labels, pricing, map pin styling.
 */

export const SERVICE_TYPES = [
  "bond_cleaning",
  "recurring_house_cleaning",
  "airbnb_turnover",
  "deep_clean",
] as const;

export type ServiceTypeKey = (typeof SERVICE_TYPES)[number];

export const RECURRING_FREQUENCIES = ["weekly", "fortnightly", "monthly"] as const;
export type RecurringFrequencyKey = (typeof RECURRING_FREQUENCIES)[number];

export const DEEP_CLEAN_PURPOSES = [
  "deep_clean",
  "spring_clean",
  "move_in_clean",
] as const;
export type DeepCleanPurposeKey = (typeof DEEP_CLEAN_PURPOSES)[number];

export const DEFAULT_SERVICE_TYPE: ServiceTypeKey = "bond_cleaning";

export function normalizeServiceType(raw: string | null | undefined): ServiceTypeKey {
  const t = String(raw ?? "").trim();
  if ((SERVICE_TYPES as readonly string[]).includes(t)) return t as ServiceTypeKey;
  return DEFAULT_SERVICE_TYPE;
}

export function serviceTypeLabel(key: ServiceTypeKey | string | null | undefined): string {
  switch (normalizeServiceType(key)) {
    case "bond_cleaning":
      return "Bond cleaning";
    case "recurring_house_cleaning":
      return "Recurring house cleaning";
    case "airbnb_turnover":
      return "Airbnb / short-stay turnover";
    case "deep_clean":
      return "Deep / spring / move-in clean";
    default:
      return "Cleaning";
  }
}

export function recurringFrequencyMultiplier(freq: string | null | undefined): number {
  switch (String(freq ?? "").toLowerCase()) {
    case "weekly":
      return 0.88;
    case "fortnightly":
      return 0.98;
    case "monthly":
      return 1.12;
    default:
      return 1;
  }
}

export function recurringFrequencyShortLabel(freq: string | null | undefined): string {
  switch (String(freq ?? "").toLowerCase()) {
    case "weekly":
      return "Weekly";
    case "fortnightly":
      return "Fortnightly";
    case "monthly":
      return "Monthly";
    default:
      return "";
  }
}

/** Bright green recurring badge for cards (emoji + label). */
export function recurringListingBadgeText(freq: string | null | undefined): string | null {
  const short = recurringFrequencyShortLabel(freq);
  if (!short) return null;
  return `🔄 ${short}`;
}

export function deepCleanPurposeLabel(key: string | null | undefined): string {
  switch (String(key ?? "").toLowerCase()) {
    case "deep_clean":
      return "Deep clean";
    case "spring_clean":
      return "Spring clean";
    case "move_in_clean":
      return "Move-in clean";
    default:
      return "";
  }
}

/** Dominant service type from counts (for cluster colour). */
export function dominantServiceTypeFromCounts(
  counts: Partial<Record<ServiceTypeKey, number>>
): ServiceTypeKey {
  let best: ServiceTypeKey = "bond_cleaning";
  let n = -1;
  for (const k of SERVICE_TYPES) {
    const c = counts[k] ?? 0;
    if (c > n) {
      n = c;
      best = k;
    }
  }
  return best;
}
