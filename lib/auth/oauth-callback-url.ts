import { sanitizeInternalNextPath } from "@/lib/safe-redirect";

/**
 * Build the app URL Supabase redirects to after OAuth (must match Dashboard → Auth → Redirect URLs).
 */
export function buildAuthCallbackUrl(
  origin: string,
  options: { next?: string; ref?: string | null }
): string {
  const params = new URLSearchParams();
  const next = sanitizeInternalNextPath(options.next?.trim(), "/dashboard");
  params.set("next", next);
  const ref = options.ref?.trim();
  if (ref) params.set("ref", ref);
  return `${origin.replace(/\/$/, "")}/auth/callback?${params.toString()}`;
}
