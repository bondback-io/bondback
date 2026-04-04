import { type NextRequest } from "next/server";
import { handleAuthConfirmRequest } from "@/lib/auth/confirm-email-handler";

export const dynamic = "force-dynamic";

/**
 * Email confirmation — GET only.
 * Supabase redirects here with `?code=…` (PKCE) or `?token_hash=…&type=signup` (legacy OTP).
 * Recommended template link:
 * `https://www.bondback.io/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
 *
 * On success, session cookies are set and the user is redirected via `redirectAfterAuthSessionEstablished`
 * (role-based: `/lister/dashboard`, `/cleaner/dashboard`, or onboarding when no role yet).
 */
export async function GET(request: NextRequest) {
  return handleAuthConfirmRequest(request);
}
