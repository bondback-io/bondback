/** Keys available in the "Special areas" step of the new listing form. */
export const LISTING_SPECIAL_AREA_KEYS = ["balcony", "garage", "laundry", "patio"] as const;

export type ListingSpecialAreaKey = (typeof LISTING_SPECIAL_AREA_KEYS)[number];

export function listingSpecialAreasSet(listing: {
  special_areas?: string[] | null;
}): Set<string> {
  const raw = listing.special_areas;
  if (!Array.isArray(raw) || raw.length === 0) return new Set();
  return new Set(raw.filter((x): x is string => typeof x === "string" && x.trim() !== ""));
}

export function isListingAddonSpecialArea(
  listing: { special_areas?: string[] | null },
  addonKey: string
): boolean {
  return listingSpecialAreasSet(listing).has(addonKey);
}

/**
 * Job checklist labels: when `special_areas` is present on the row, only those keys are "special".
 * If the column is missing/null (legacy rows), fall back to key-in-known-special-areas (old behaviour).
 */
export function isSpecialAreaForJobChecklist(
  listing: { special_areas?: string[] | null } | null | undefined,
  key: string
): boolean {
  const raw = listing?.special_areas;
  if (Array.isArray(raw)) {
    return raw.includes(key);
  }
  return (LISTING_SPECIAL_AREA_KEYS as readonly string[]).includes(key);
}
