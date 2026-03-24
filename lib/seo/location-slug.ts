const AU_STATES = new Set(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"]);

export function titleCaseWords(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** URL slug: `parramatta-nsw-2150` from DB row fields. */
export function buildLocationSlug(
  suburb: string,
  state: string,
  postcode: string
): string {
  const normalized = suburb
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const pc = postcode.replace(/\D/g, "").slice(0, 4);
  return `${normalized}-${state.trim().toLowerCase()}-${pc}`;
}

/** Reverse `buildLocationSlug` — last segment is 4-digit postcode, then state. */
export function parseLocationSlug(
  slug: string
): { suburb: string; state: string; postcode: string } | null {
  const m = slug.match(/-([a-z]{2,3})-(\d{4})$/i);
  if (!m?.[1] || !m[2]) return null;
  const state = m[1].toUpperCase();
  if (!AU_STATES.has(state)) return null;
  const postcode = m[2];
  const suburbSlug = slug.slice(0, slug.length - m[0].length);
  if (!suburbSlug.trim()) return null;
  const suburb = titleCaseWords(suburbSlug.replace(/-/g, " "));
  return { suburb, state, postcode };
}
