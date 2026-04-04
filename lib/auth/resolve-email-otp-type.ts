/**
 * Supabase email links pass `type` on the redirect URL. For legacy OTP `token_hash` (non-`pkce_`),
 * it must match `verifyOtp({ token_hash, type })`. PKCE codes in `token_hash` use
 * `exchangeCodeForSession` instead (see `getEmailRedirectAuthCode`).
 *
 * Bond Back email templates should use `type=signup` (see handoff / Supabase Confirm sign up template).
 * If `type` is omitted, we default to `signup`. If the URL includes `type=email` (hosted default), we honour it.
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
  /** Default when `type` is missing — matches Bond Back template `&type=signup`. */
  return "signup";
}
