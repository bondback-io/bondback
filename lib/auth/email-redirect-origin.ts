/**
 * Origins for Supabase **emailRedirectTo**, **signInWithOAuth redirectTo**, and **resetPassword redirectTo**.
 *
 * ## Only list these in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
 * - `https://www.bondback.io/**` (production; canonical host — see `proxy.ts` apex→www)
 * - `http://localhost:3000/**` (local dev)
 *
 * **Do not** add `https://*.vercel.app/**` — Vercel preview hostnames change per deployment and will
 * clutter / auto-resurface in Supabase. This module **never** uses `*.vercel.app` for auth redirects
 * when `NEXT_PUBLIC_APP_URL` is unset (preview falls back to {@link CANONICAL_AUTH_PUBLIC_ORIGIN}).
 *
 * ## Vercel env
 * Set **`NEXT_PUBLIC_APP_URL=https://www.bondback.io`** for **Production** (required) and **Preview**
 * (recommended) so client auth always targets the canonical site. Stripe/server code may still use
 * `VERCEL_URL` in preview via `getAppBaseUrl()` in `lib/site.ts` — that is separate from Supabase.
 */
export const CANONICAL_AUTH_PUBLIC_ORIGIN = "https://www.bondback.io" as const;

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isVercelPreviewHostname(hostname: string): boolean {
  return hostname.endsWith(".vercel.app");
}

/** Production apex — must match Supabase Redirect URLs (`https://www.bondback.io/**`), not bare apex. */
function isBondBackProductionApex(hostname: string): boolean {
  return hostname === "bondback.io";
}

/**
 * Origin for Supabase `emailRedirectTo` / OAuth `redirectTo` / password reset (client components only).
 *
 * 1. **`NEXT_PUBLIC_APP_URL`** when set — always wins (use `https://www.bondback.io` in Vercel Production + Preview).
 * 2. **Localhost** — `window.location.origin` for local dev without env.
 * 3. **Vercel preview (`*.vercel.app`)** — {@link CANONICAL_AUTH_PUBLIC_ORIGIN} so Supabase never receives preview URLs.
 * 4. Else — `window.location.origin` (e.g. LAN dev hostname).
 */
export function getClientAuthEmailRedirectOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit.replace(/\/$/, "")).origin;
    } catch {
      /* fallthrough */
    }
  }

  if (typeof window === "undefined") {
    return "";
  }

  const hostname = window.location.hostname;
  if (isLocalHostname(hostname)) {
    return window.location.origin;
  }

  if (isVercelPreviewHostname(hostname)) {
    return CANONICAL_AUTH_PUBLIC_ORIGIN;
  }

  if (isBondBackProductionApex(hostname)) {
    return CANONICAL_AUTH_PUBLIC_ORIGIN;
  }

  return window.location.origin;
}

/**
 * Same rules as {@link getClientAuthEmailRedirectOrigin}, but never returns empty (SSR-safe fallbacks).
 * Use when building `emailRedirectTo` so Supabase always receives an allowlisted absolute URL.
 */
export function getResolvedAuthEmailRedirectOrigin(): string {
  const o = getClientAuthEmailRedirectOrigin();
  if (o) return o;
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit.replace(/\/$/, "")).origin;
    } catch {
      return CANONICAL_AUTH_PUBLIC_ORIGIN;
    }
  }
  return CANONICAL_AUTH_PUBLIC_ORIGIN;
}

/** Alias — same rules as {@link getClientAuthEmailRedirectOrigin} (OAuth / email / recovery). */
export function getClientAuthRedirectOrigin(): string {
  return getClientAuthEmailRedirectOrigin();
}
