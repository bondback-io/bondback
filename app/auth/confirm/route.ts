import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";

function confirmErrorRedirect(origin: string, message: string) {
  return NextResponse.redirect(
    new URL(`/auth/confirm/error?message=${encodeURIComponent(message)}`, origin)
  );
}

/**
 * Email confirmation: `exchangeCodeForSession` (PKCE) or `verifyOtp` (token_hash + type).
 * Session cookies are applied via `createSupabaseRouteHandlerClient` + `authCookieResponse`
 * (see `redirectAfterAuthSessionEstablished`).
 */
export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash") ?? searchParams.get("token");
  const typeParam = searchParams.get("type");
  const error = searchParams.get("error");
  const error_code = searchParams.get("error_code");
  const error_description = searchParams.get("error_description");

  const next = sanitizeInternalNextPath(searchParams.get("next"), "/dashboard");
  const signupFlow = searchParams.get("flow");
  const refParam = searchParams.get("ref");

  console.log("[auth/confirm] request", {
    origin,
    path: request.nextUrl.pathname,
    hasCode: Boolean(code),
    hasTokenHash: Boolean(token_hash),
    type: typeParam ?? "(default signup)",
    hasError: Boolean(error || error_code),
    next,
  });

  if (error || error_code) {
    const msg =
      error_description?.replace(/\+/g, " ") ||
      error ||
      "Email confirmation was cancelled or could not be completed.";
    console.warn("[auth/confirm] oauth error params", { error, error_code, msg });
    return confirmErrorRedirect(origin, msg);
  }

  if (!code && !token_hash) {
    console.warn("[auth/confirm] missing code and token_hash");
    return confirmErrorRedirect(
      origin,
      "Invalid or missing confirmation link. Open the latest email from Bond Back or request a new confirmation from sign up."
    );
  }

  const authCookieResponse = NextResponse.redirect(new URL("/dashboard", origin));
  const supabase = createSupabaseRouteHandlerClient(request, authCookieResponse);

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("[auth/confirm] exchangeCodeForSession", exchangeError.message);
      return confirmErrorRedirect(
        origin,
        "This confirmation link failed or expired. Request a new email from the sign-up page or log in."
      );
    }
    return redirectAfterAuthSessionEstablished({
      supabase,
      request,
      next,
      signupFlow,
      refParam,
      authCookieResponse,
    });
  }

  const otpType = (typeParam ?? "signup") as
    | "signup"
    | "email"
    | "recovery"
    | "invite"
    | "magiclink"
    | "email_change";

  const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
    token_hash: token_hash!,
    type: otpType,
  });

  if (otpError) {
    console.error("[auth/confirm] verifyOtp", otpError.message, { type: otpType });
    return confirmErrorRedirect(
      origin,
      otpError.message ||
        "This confirmation link failed or expired. Request a new email from the sign-up page."
    );
  }

  console.log("[auth/confirm] verifyOtp ok", {
    userId: otpData.user?.id ?? null,
    session: Boolean(otpData.session),
  });

  return redirectAfterAuthSessionEstablished({
    supabase,
    request,
    next,
    signupFlow,
    refParam,
    authCookieResponse,
  });
};
