/**
 * Add-on keys and labels for new listings. Amounts come from Global Settings → Pricing Modifiers
 * via {@link getListingAddonPriceFromModifiers} in `lib/pricing-modifiers.ts`.
 */

export const LISTING_ADDON_KEYS = [
  "oven",
  "carpet_steam",
  "windows",
  "balcony",
  "garage",
  "laundry",
  "patio",
  "fridge",
  "walls",
  "blinds",
] as const;

export type ListingAddonKey = (typeof LISTING_ADDON_KEYS)[number];

const LISTING_ADDON_LABELS: Record<ListingAddonKey, string> = {
  oven: "Oven",
  carpet_steam: "Carpet steam",
  windows: "Windows",
  balcony: "Balcony",
  garage: "Garage",
  laundry: "Laundry",
  patio: "Patio",
  fridge: "Fridge",
  walls: "Walls",
  blinds: "Blinds",
};

export function getListingAddonLabel(key: ListingAddonKey): string {
  return LISTING_ADDON_LABELS[key];
}

/** Legacy bundle key from a removed checkbox; still may appear on old listing rows. */
export const WALLS_CARPET_STEAMING_ADDON_KEY = "walls_carpet_steaming" as const;

export function formatListingAddonDisplayName(key: string): string {
  if (key === WALLS_CARPET_STEAMING_ADDON_KEY) return "Walls & carpet steaming";
  return key.replace(/_/g, " ");
}
