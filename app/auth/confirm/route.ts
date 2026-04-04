import { type NextRequest } from "next/server";
import { handleAuthConfirmRequest } from "@/lib/auth/confirm-email-handler";
import { redactTokenHashForLog } from "@/lib/auth/auth-confirm-log";

export const dynamic = "force-dynamic";

/**
 * Email confirmation — GET only.
 * Supabase redirects here with `?code=…` (PKCE) or `?token_hash=…&type=signup` (legacy OTP).
 * Recommended template link:
 * `https://www.bondback.io/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
 *
 * Detailed `verifyOtp` / `exchangeCodeForSession` logs use the same `[auth/confirm]` prefix
 * from `lib/auth/establish-email-session.ts` (search logs for `verifyOtp` / `exchangeCodeForSession`).
 */
export async function GET(request: NextRequest) {
  const u = request.nextUrl;
  const fullUrl = request.url;
  const code = u.searchParams.get("code")?.trim() ?? null;
  const token_hash = (u.searchParams.get("token_hash") ?? u.searchParams.get("token"))?.trim() ?? null;
  const typeParam = u.searchParams.get("type")?.trim() ?? null;
  const hasOAuthError = Boolean(u.searchParams.get("error") || u.searchParams.get("error_code"));

  console.log("[auth/confirm] route_incoming", {
    fullUrl,
    host: u.host,
    pathname: u.pathname,
    hasCode: Boolean(code),
    hasTokenHash: Boolean(token_hash),
    token_hash_preview: redactTokenHashForLog(token_hash),
    typeParam: typeParam ?? "(missing — handler defaults to signup)",
    hasOAuthError,
    queryKeys: [...u.searchParams.keys()],
  });

  const res = await handleAuthConfirmRequest(request);

  const loc = res.headers.get("location");
  const status = res.status;
  console.log("[auth/confirm] route_outgoing", {
    status,
    redirectLocation: loc,
    redirectLocationLength: loc?.length ?? 0,
  });

  return res;
}
