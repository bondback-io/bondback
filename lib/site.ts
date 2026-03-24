/**
 * Canonical public site URL for metadata, sitemap, and Open Graph.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://bondback.com.au).
 * Falls back to NEXT_PUBLIC_APP_URL, then a sensible Australia-focused default.
 */
export function getSiteUrl(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      const normalized = raw.endsWith("/") ? raw.slice(0, -1) : raw;
      return new URL(normalized);
    } catch {
      // fallthrough
    }
  }
  return new URL("https://bondback.com.au");
}
