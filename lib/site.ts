function originFromVercelUrl(vercel: string): string | null {
  const withProto =
    vercel.startsWith("http://") || vercel.startsWith("https://")
      ? vercel
      : `https://${vercel}`;
  try {
    return new URL(withProto).origin;
  } catch {
    return null;
  }
}

/**
 * Base origin for Stripe success/cancel redirects, Connect return URLs, and server actions.
 *
 * **Preview deployments:** Uses `VERCEL_URL` so redirects return to the same host as the
 * user’s session cookies. If `NEXT_PUBLIC_APP_URL` pointed at production while testing on a
 * preview URL, Stripe would send users to production without a session → login loop.
 *
 * **Production:** Uses `NEXT_PUBLIC_APP_URL` when set (canonical domain), else `VERCEL_URL`.
 *
 * Local: `NEXT_PUBLIC_APP_URL` or `http://localhost:3000`.
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const vercel = process.env.VERCEL_URL?.trim();
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === "preview" && vercel) {
    const o = originFromVercelUrl(vercel);
    if (o) return o;
  }

  if (explicit) {
    const normalized = explicit.replace(/\/$/, "");
    try {
      return new URL(normalized).origin;
    } catch {
      /* fallthrough */
    }
  }

  if (vercel) {
    const o = originFromVercelUrl(vercel);
    if (o) return o;
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
