/**
 * Origin for Supabase `emailRedirectTo` / `resend` (client components only).
 *
 * Prefer `NEXT_PUBLIC_APP_URL` so confirmation links open your **canonical** app (e.g. production)
 * instead of a transient hostname (`*.vercel.app` preview, wrong subdomain). Preview URLs are often
 * behind **Vercel Deployment Protection**, which shows a Vercel login to unauthenticated visitors —
 * exactly what users see when the email link points at a protected preview.
 *
 * Falls back to `window.location.origin` when unset (local dev without env, or tests).
 */
export function getClientAuthEmailRedirectOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit.replace(/\/$/, "")).origin;
    } catch {
      /* invalid env — fall back */
    }
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}
