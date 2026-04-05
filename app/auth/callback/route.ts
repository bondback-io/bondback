import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";
import { resolveEmailOtpTypeFromSearchParams } from "@/lib/auth/resolve-email-otp-type";
import { establishSessionFromEmailRedirectParams } from "@/lib/auth/establish-email-session";

export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code")?.trim() || null;
  const token_hash_raw = searchParams.get("token_hash") ?? searchParams.get("token");
  const token_hash = token_hash_raw?.trim() || null;
  const error = searchParams.get("error");
  const error_code = searchParams.get("error_code");
  const error_description = searchParams.get("error_description");

  const next = sanitizeInternalNextPath(searchParams.get("next"), "/dashboard");
  const signupFlow = searchParams.get("flow");
  const refParam = searchParams.get("ref");

  if (error || error_code) {
    const msg =
      error_description?.replace(/\+/g, " ") ||
      error ||
      "Sign-in was cancelled or failed. Try again.";
    return NextResponse.redirect(
      new URL(`/login?message=${encodeURIComponent(msg)}`, origin)
    );
  }

  if (!code && !token_hash) {
    const url = new URL("/login", origin);
    url.searchParams.set("message", "confirm_link_invalid");
    return NextResponse.redirect(url);
  }

  const authCookieResponse = NextResponse.redirect(new URL("/dashboard", origin));
  const supabase = createSupabaseRouteHandlerClient(request, authCookieResponse);

  const resolvedOtpType = resolveEmailOtpTypeFromSearchParams(searchParams);

  const outcome = await establishSessionFromEmailRedirectParams(supabase, {
    code,
    tokenHash: token_hash,
    otpType: resolvedOtpType,
  });

  if (!outcome.ok) {
    console.error("[auth/callback] establish_session_failed", {
      method: outcome.method,
      message: outcome.error.message,
    });
    const url = new URL("/login", origin);
    url.searchParams.set("message", "confirm_link_expired");
    return NextResponse.redirect(url);
  }

  return redirectAfterAuthSessionEstablished({
    supabase,
    request,
    next,
    signupFlow,
    refParam,
    authCookieResponse,
    sessionFromAuth: outcome.session,
  });
};
