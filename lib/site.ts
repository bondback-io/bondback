/**
 * Base origin for Stripe success/cancel redirects, Connect return URLs, and server actions.
 *
 * Priority:
 * 1. `NEXT_PUBLIC_APP_URL` (set in Vercel to your canonical URL, e.g. https://bondback.vercel.app)
 * 2. `VERCEL_URL` (injected on Vercel; prefixed with https://)
 * 3. `http://localhost:3000` for local dev
 *
 * Test mode vs live mode does not change this — only which Stripe keys are used.
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    const normalized = explicit.replace(/\/$/, "");
    try {
      return new URL(normalized).origin;
    } catch {
      /* fallthrough */
    }
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const withProto =
      vercel.startsWith("http://") || vercel.startsWith("https://")
        ? vercel
        : `https://${vercel}`;
    try {
      return new URL(withProto).origin;
    } catch {
      /* fallthrough */
    }
  }
  return "http://localhost:3000";
}

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
