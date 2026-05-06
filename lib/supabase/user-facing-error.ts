/**
 * Browser/Supabase-js surfaces raw TypeError strings (e.g. "Failed to fetch") when
 * the PostgREST request never completes. Map those to short UI copy.
 */
export function userFacingSupabaseErrorMessage(
  raw: string | null | undefined
): string {
  if (raw == null || raw.trim() === "") {
    return "Something went wrong. Please try again.";
  }
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    (lower.includes("typeerror") && lower.includes("fetch")) ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("network request failed")
  ) {
    return "Couldn't reach the server. Check your connection and refresh this page.";
  }
  return t;
}

export function isLikelyTransientNetworkError(
  message: string | null | undefined
): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    (lower.includes("typeerror") && lower.includes("fetch")) ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("network request failed")
  );
}
