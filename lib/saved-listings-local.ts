/** Client-only favourites (no backend). Used from listing / job flows. */
const STORAGE_KEY = "bondback_saved_listing_ids";

export function getSavedListingIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function addSavedListingId(id: string): void {
  if (typeof window === "undefined") return;
  const next = new Set(getSavedListingIds());
  next.add(id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
}

export function removeSavedListingId(id: string): void {
  if (typeof window === "undefined") return;
  const next = getSavedListingIds().filter((x) => x !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
