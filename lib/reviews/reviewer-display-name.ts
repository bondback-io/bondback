/**
 * Display name for a review author (lister) when showing public review snippets.
 * Prefer full_name; otherwise combine first + last from profile rows.
 */
export function formatReviewerDisplayName(
  reviewer:
    | {
        full_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }
    | null
    | undefined
): string | null {
  if (!reviewer) return null;
  const full = String(reviewer.full_name ?? "").trim();
  if (full) return full;
  const first = String(reviewer.first_name ?? "").trim();
  const last = String(reviewer.last_name ?? "").trim();
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || null;
}
