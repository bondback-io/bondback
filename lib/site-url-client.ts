/** Client-safe canonical origin for admin SEO / GSC (matches `getSiteUrl()` fallbacks). */
export function getSiteOriginClient(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      const n = raw.endsWith("/") ? raw.slice(0, -1) : raw;
      return new URL(n).origin;
    } catch {
      /* fall through */
    }
  }
  return "https://www.bondback.io";
}
