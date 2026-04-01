import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";

/** Avoid stale redirects in mobile in-app browsers / proxies. */
function noStoreHeaders(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.headers.set("Pragma", "no-cache");
  return res;
}

function confirmErrorRedirect(origin: string, message: string) {
  const res = NextResponse.redirect(
    new URL(`/auth/confirm/error?message=${encodeURIComponent(message)}`, origin)
  );
  return noStoreHeaders(res);
}

/**
 * Email confirmation (signup) — **use this route only** for confirm-signup links, not `/auth/callback`.
 * `/auth/callback` is for OAuth PKCE; mixing both in Supabase “Redirect URLs” for the same email action
 * causes wrong redirects and “login” loops. Configure:
 *
 * - **Authentication → URL Configuration → Redirect URLs:** include exactly your app origins, e.g.
 *   `https://your-production-domain.com/auth/confirm**`
 *   `http://localhost:3000/auth/confirm**`
 *   Keep `/auth/callback**` only for OAuth if needed — **Confirm signup email template** must point
 *   to `/auth/confirm` (or use `{{ .ConfirmationURL }}` after `signUp({ emailRedirectTo: .../auth/confirm?... })`).
 * - **Site URL:** your live app URL (e.g. `https://www.bondback.io`).
 *
 * Flow: `verifyOtp({ type: 'signup', token_hash })` OR `exchangeCodeForSession(code)` → session cookies
 * on the response → role-based redirect via `redirectAfterAuthSessionEstablished`.
 */
export const GET = async (request: NextRequest) => {
  const started = Date.now();
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

  const paramKeys = [...searchParams.keys()].filter(
    (k) => !["token_hash", "token", "code"].includes(k)
  );

  console.log("[auth/confirm] GET", {
    origin,
    pathname: request.nextUrl.pathname,
    hasCode: Boolean(code),
    hasTokenHash: Boolean(token_hash),
    type: typeParam ?? "signup (default)",
    hasOAuthError: Boolean(error || error_code),
    next,
    paramKeys,
  });

  try {
    if (error || error_code) {
      const msg =
        error_description?.replace(/\+/g, " ") ||
        error ||
        "Email confirmation was cancelled or could not be completed.";
      console.warn("[auth/confirm] oauth_error", { error, error_code, msg });
      return confirmErrorRedirect(origin, msg);
    }

    if (!code && !token_hash) {
      console.warn("[auth/confirm] missing_code_and_token", {
        hint: "Confirm signup template must link to /auth/confirm?token_hash=...&type=signup (or PKCE ?code=...). Check Supabase Redirect URLs include .../auth/confirm**",
      });
      return confirmErrorRedirect(
        origin,
        "Invalid or missing confirmation link. Open the latest email from Bond Back or request a new confirmation from sign up."
      );
    }

    const authCookieResponse = NextResponse.redirect(new URL("/dashboard", origin));
    noStoreHeaders(authCookieResponse);
    const supabase = createSupabaseRouteHandlerClient(request, authCookieResponse);

    if (code) {
      console.log("[auth/confirm] pkce_exchange_start");
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error("[auth/confirm] exchangeCodeForSession_failed", {
          message: exchangeError.message,
          name: exchangeError.name,
        });
        return confirmErrorRedirect(
          origin,
          "This confirmation link failed or expired. Request a new email from the sign-up page or log in."
        );
      }
      console.log("[auth/confirm] pkce_exchange_ok", { ms: Date.now() - started });
      const res = await redirectAfterAuthSessionEstablished({
        supabase,
        request,
        next,
        signupFlow,
        refParam,
        authCookieResponse,
      });
      return noStoreHeaders(res);
    }

    const otpType = (typeParam ?? "signup") as
      | "signup"
      | "email"
      | "recovery"
      | "invite"
      | "magiclink"
      | "email_change";

    console.log("[auth/confirm] verifyOtp_start", { type: otpType });

    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      token_hash: token_hash!,
      type: otpType,
    });

    if (otpError) {
      console.error("[auth/confirm] verifyOtp_failed", {
        message: otpError.message,
        status: otpError.status,
        type: otpType,
      });
      return confirmErrorRedirect(
        origin,
        otpError.message ||
          "This confirmation link failed or expired. Request a new email from the sign-up page."
      );
    }

    const session = otpData.session;
    const user = otpData.user;
    console.log("[auth/confirm] verifyOtp_ok", {
      userId: user?.id ?? null,
      hasSession: Boolean(session),
      emailConfirmed: Boolean(user?.email_confirmed_at),
      ms: Date.now() - started,
    });

    const res = await redirectAfterAuthSessionEstablished({
      supabase,
      request,
      next,
      signupFlow,
      refParam,
      authCookieResponse,
    });
    return noStoreHeaders(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[auth/confirm] unhandled_error", { message, stack: e instanceof Error ? e.stack : undefined });
    return confirmErrorRedirect(
      origin,
      "Something went wrong confirming your email. Try the link again or log in from the sign-up page."
    );
  }
};
