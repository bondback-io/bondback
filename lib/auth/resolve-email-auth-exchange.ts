/**
 * Supabase Auth email links (PKCE) may pass the one-time auth code as `?code=…` **or** as
 * `?token_hash=pkce_…` (the `pkce_` prefix marks a PKCE auth code, not a legacy OTP hash).
 *
 * PKCE codes must be exchanged with `exchangeCodeForSession(code)`. Calling `verifyOtp` with a
 * `pkce_` value is the wrong API and can cause long delays, flaky failures, or misleading
 * “expired” errors — especially on mobile email clients.
 *
 * @see https://supabase.com/docs/guides/auth/sessions/pkce-flow
 */
export type EmailAuthExchangeSource = "query_code" | "pkce_token_hash";

export function getEmailRedirectAuthCode(
  code: string | null | undefined,
  tokenHash: string | null | undefined
): { authCode: string; source: EmailAuthExchangeSource } | null {
  const trimmedCode = code?.trim();
  if (trimmedCode) {
    return { authCode: trimmedCode, source: "query_code" };
  }
  const th = tokenHash?.trim();
  if (th?.startsWith("pkce_")) {
    return { authCode: th, source: "pkce_token_hash" };
  }
  return null;
}
