/**
 * Supabase email links pass `type` on the redirect URL. The hosted "Confirm signup" template’s
 * `{{ .ConfirmationURL }}` uses `type=email` (see Auth → Email templates docs), not `type=signup`.
 * `verifyOtp({ token_hash, type })` must use the **same** type or Auth returns "invalid or expired".
 */
const EMAIL_OTP_TYPES = [
  "signup",
  "email",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
] as const;

export type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export function resolveEmailOtpTypeFromSearchParams(
  searchParams: URLSearchParams
): EmailOtpType {
  const raw = searchParams.get("type")?.trim().toLowerCase() ?? "";
  if (raw && (EMAIL_OTP_TYPES as readonly string[]).includes(raw)) {
    return raw as EmailOtpType;
  }
  /** Default matches Supabase’s documented ConfirmationURL for signup (`type=email`). */
  return "email";
}
