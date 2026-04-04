/**
 * Canonical links in outbound React Email templates.
 * Production uses https://www.bondback.io; local dev may use localhost when NEXT_PUBLIC_APP_URL is set.
 */
export const EMAIL_CANONICAL_ORIGIN = "https://www.bondback.io" as const;

export function emailPublicOrigin(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (u && (u.includes("localhost") || u.includes("127.0.0.1"))) {
    return u;
  }
  return EMAIL_CANONICAL_ORIGIN;
}
