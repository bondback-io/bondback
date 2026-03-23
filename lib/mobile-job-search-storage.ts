/** Persisted suburb/postcode for mobile job search (paired with jobs-radius-local). */

const SUBURB_KEY = "bondback_jobs_search_suburb";
const POSTCODE_KEY = "bondback_jobs_search_postcode";

export function getStoredSearchSuburb(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(SUBURB_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function setStoredSearchSuburb(value: string): void {
  if (typeof window === "undefined") return;
  try {
    const t = value.trim();
    if (t) window.localStorage.setItem(SUBURB_KEY, t);
    else window.localStorage.removeItem(SUBURB_KEY);
  } catch {
    /* ignore */
  }
}

export function getStoredSearchPostcode(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(POSTCODE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function setStoredSearchPostcode(value: string): void {
  if (typeof window === "undefined") return;
  try {
    const t = value.replace(/\D/g, "").slice(0, 4);
    if (t) window.localStorage.setItem(POSTCODE_KEY, t);
    else window.localStorage.removeItem(POSTCODE_KEY);
  } catch {
    /* ignore */
  }
}
