import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";
import { resolveEmailOtpTypeFromSearchParams } from "@/lib/auth/resolve-email-otp-type";
import { establishSessionFromEmailRedirectParams } from "@/lib/auth/establish-email-session";

export const dynamic = "force-dynamic";

function readTokenHash(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("token_hash") ?? searchParams.get("token");
  if (raw == null) return null;
  const t = raw.trim();
  return t || null;
}

/**
 * Email confirmation — GET only.
 *
 * Uses the same session logic as `/auth/callback`: `createSupabaseRouteHandlerClient` wraps
 * `createServerClient` from `@supabase/ssr` with cookies written onto the redirect response (required
 * on Vercel). PKCE links use `token_hash=pkce_…` or `?code=…` — those must go through
 * `exchangeCodeForSession`, not `verifyOtp` alone (see `getEmailRedirectAuthCode`).
 */
export async function GET(request: NextRequest) {
  console.log("=== CONFIRM ROUTE HIT ===", {
    url: request.url,
    searchParams: Object.fromEntries(request.nextUrl.searchParams),
  });

  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code")?.trim() || null;
  const token_hash = readTokenHash(searchParams);
  const type = searchParams.get("type");
  const otpType = resolveEmailOtpTypeFromSearchParams(searchParams);

  console.log("Extracted token_hash:", token_hash, "type:", type, "otpType:", otpType, "code:", code ? "[present]" : null);

  const redirectToLogin = () => NextResponse.redirect(new URL("/login", origin));

  if (!code && !token_hash) {
    console.log("Verification failed:", { reason: "missing_code_and_token_hash" });
    return redirectToLogin();
  }

  const authCookieResponse = NextResponse.redirect(new URL("/dashboard", origin));
  const supabase = createSupabaseRouteHandlerClient(request, authCookieResponse);

  console.log("Calling establishSessionFromEmailRedirectParams (PKCE exchange or verifyOtp)…");

  const outcome = await establishSessionFromEmailRedirectParams(supabase, {
    code,
    tokenHash: token_hash,
    otpType,
  });

  console.log("verifyOtp / exchange result:", {
    ok: outcome.ok,
    method: outcome.method,
    userId: outcome.ok ? outcome.user.id : null,
    error: outcome.ok ? null : outcome.error.message,
  });

  if (!outcome.ok) {
    console.log("Verification failed:", outcome.error);
    return redirectToLogin();
  }

  const userId = outcome.user.id;
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("active_role")
    .eq("id", userId)
    .maybeSingle();
  const active_role =
    (profileRow as { active_role?: string | null } | null)?.active_role ?? null;

  console.log("Session created successfully, user ID:", userId, "active_role:", active_role);

  return redirectAfterAuthSessionEstablished({
    supabase,
    request,
    next: "/dashboard",
    signupFlow: null,
    refParam: null,
    authCookieResponse,
    sessionFromAuth: outcome.session,
  });
}
