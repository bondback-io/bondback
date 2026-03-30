const STORAGE_KEY = "bondback-listing-draft-v1";

export type ListingDraftStored = {
  savedAt: string;
  step: number;
  /** Serialized listing form fields (dates as ISO strings) */
  values: Record<string, unknown>;
};

export function saveListingDraftLocal(draft: ListingDraftStored): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadListingDraftLocal(): ListingDraftStored | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ListingDraftStored;
    if (!parsed || typeof parsed.values !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearListingDraftLocal(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
