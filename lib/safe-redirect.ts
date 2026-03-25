/**
 * Post-login / OAuth `next` param must stay on this app (blocks open redirects like `//evil.com`).
 * Use for `/auth/callback`, OAuth query building, and any server redirect from user-controlled input.
 */
export function sanitizeInternalNextPath(
  raw: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (raw == null || typeof raw !== "string") return fallback;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  if (t.includes("\\")) return fallback;
  return t;
}
