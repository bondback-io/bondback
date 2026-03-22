/**
 * Australian postcode to state/territory abbreviation.
 * Uses first digit(s) for a simple mapping (covers most residential postcodes).
 */
export function getStateFromPostcode(postcode: string | null | undefined): string | null {
  if (postcode == null || String(postcode).trim() === "") return null;
  const s = String(postcode).trim();
  const num = parseInt(s.replace(/\D/g, "").slice(0, 4), 10);
  if (Number.isNaN(num)) return null;
  const first = Math.floor(num / 1000);
  const second = Math.floor((num % 1000) / 100);
  // ACT: 2600-2618, 2900-2920
  if (num >= 2600 && num <= 2618) return "ACT";
  if (num >= 2900 && num <= 2920) return "ACT";
  // NT: 0800-0899, 0900-0999
  if (first === 0) return "NT";
  // NSW: 2xxx (except ACT), 2619-2599 is NSW, 2921+
  if (first === 2) return "NSW";
  // VIC: 3xxx, 8xxx
  if (first === 3 || first === 8) return "VIC";
  // QLD: 4xxx, 9xxx
  if (first === 4 || first === 9) return "QLD";
  // SA: 5xxx
  if (first === 5) return "SA";
  // WA: 6xxx
  if (first === 6) return "WA";
  // TAS: 7xxx
  if (first === 7) return "TAS";
  return null;
}

/**
 * Format location for display: "Suburb Postcode State" (e.g. "Surry Hills 2010 NSW").
 * Use on job cards, job details, and listing overviews.
 */
export function formatLocationWithState(
  suburb: string | null | undefined,
  postcode: string | null | undefined
): string {
  const s = String(suburb ?? "").trim();
  const p = String(postcode ?? "").trim();
  const parts = [s, p].filter(Boolean);
  const state = getStateFromPostcode(p || postcode);
  if (state) parts.push(state);
  return parts.join(" ") || "—";
}
