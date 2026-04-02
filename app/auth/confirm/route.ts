import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";

/** Signup confirmation emails (SiteURL template) must use verifyOtp type `signup`. */
const SIGNUP_OTP_TYPE = "signup" as const;

/** Avoid stale redirects in mobile in-app browsers / proxies. */
function noStoreHeaders(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.headers.set("Pragma", "no-cache");
  return res;
}

/** Log shape without exposing full secrets in Vercel/server logs. */
function redactTokenHash(token: string | null): string | null {
  if (!token) return null;
  if (token.length <= 12) return `[len=${token.length}]`;
  return `${token.slice(0, 4)}…${token.slice(-4)} (len=${token.length})`;
}

function logRedirectDestination(source: string, res: NextResponse) {
  const location = res.headers.get("location");
  console.log("[auth/confirm] redirect_destination", { source, location });
}

function confirmErrorRedirect(origin: string, message: string, reason?: string) {
  const url = new URL("/auth/confirm/error", origin);
  url.searchParams.set("message", message);
  if (reason) url.searchParams.set("reason", reason);
  const res = NextResponse.redirect(url);
  return noStoreHeaders(res);
}

/**
 * Read `token_hash` or legacy `token` from the query string (trim + safe decode).
 * SiteURL template: `.../auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=...`
 */
function readTokenHashFromRequest(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("token_hash") ?? searchParams.get("token");
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

/**
 * Read optional `type` from the query for logging only. Verification always uses `signup` on this route.
 */
function readTypeParamForLog(searchParams: URLSearchParams): string | null {
  const t = searchParams.get("type");
  if (t == null) return null;
  const s = t.trim();
  return s.length ? s : null;
}

/**
 * ============================================================================
 * SUPABASE — "Confirm sign up" (Site URL template)
 * ============================================================================
 * ```html
 * <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=%2Fdashboard">
 *   Confirm your email
 * </a>
 * ```
 * Or use `{{ .ConfirmationURL }}` (Supabase builds the full URL; may return `code` for PKCE).
 *
 * Redirect URLs: `https://YOUR_DOMAIN/auth/confirm**` (+ localhost).
 *
 * After success, session cookies are set and the user is redirected via
 * `redirectAfterAuthSessionEstablished`: when `next` is `/dashboard` and the profile has roles,
 * destination is **active_role** — lister → `/lister/dashboard`, cleaner → `/cleaner/dashboard`;
 * if there are no roles yet → `/onboarding/role-choice`.
 * ============================================================================
 */
export const GET = async (request: NextRequest) => {
  const started = Date.now();
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code")?.trim() || null;
  const token_hash = readTokenHashFromRequest(searchParams);
  const typeFromQuery = readTypeParamForLog(searchParams);
  const error = searchParams.get("error");
  const error_code = searchParams.get("error_code");
  const error_description = searchParams.get("error_description");

  const next = sanitizeInternalNextPath(searchParams.get("next"), "/dashboard");
  const signupFlow = searchParams.get("flow");
  const refParam = searchParams.get("ref");

  const paramKeys = [...searchParams.keys()].filter(
    (k) => !["token_hash", "token", "code"].includes(k)
  );

  const forwardedHost = request.headers.get("x-forwarded-host");
  const rawQuery = request.nextUrl.search?.slice(0, 500) ?? "";

  if (typeFromQuery && typeFromQuery.toLowerCase() !== SIGNUP_OTP_TYPE) {
    console.warn("[auth/confirm] type_query_not_signup", {
      typeFromQuery,
      note: "verifyOtp will still use type: signup for this route",
    });
  }

  console.log("[auth/confirm] GET", {
    origin,
    host: request.nextUrl.host,
    forwardedHost,
    pathname: request.nextUrl.pathname,
    hasCode: Boolean(code),
    hasTokenHash: Boolean(token_hash),
    token_hash_preview: redactTokenHash(token_hash),
    typeFromQuery,
    verifyOtpType: code ? "pkce_exchange" : SIGNUP_OTP_TYPE,
    hasOAuthError: Boolean(error || error_code),
    next,
    paramKeys,
    querySample: rawQuery,
  });

  try {
    if (error || error_code) {
      const msg =
        error_description?.replace(/\+/g, " ") ||
        error ||
        "Email confirmation was cancelled or could not be completed.";
      console.warn("[auth/confirm] oauth_error", { error, error_code, msg });
      return confirmErrorRedirect(origin, msg, "oauth_error");
    }

    if (!code && !token_hash) {
      console.warn("[auth/confirm] missing_code_and_token", {
        hint: "Expected {{ .SiteURL }}/auth/confirm?token_hash=…&type=signup or PKCE ?code=…",
        paramKeys: [...searchParams.keys()],
        querySample: rawQuery,
      });
      return confirmErrorRedirect(
        origin,
        "This confirmation link is missing a token. Open the latest email from Bond Back, or request a new confirmation link from the sign-up page.",
        "missing_token"
      );
    }

    const authCookieResponse = NextResponse.redirect(new URL("/dashboard", origin));
    noStoreHeaders(authCookieResponse);
    const supabase = createSupabaseRouteHandlerClient(request, authCookieResponse);

    if (code) {
      console.log("[auth/confirm] pkce_exchange_start", { code_preview: `${code.slice(0, 8)}…` });
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error("[auth/confirm] exchangeCodeForSession_failed", {
          message: exchangeError.message,
          name: exchangeError.name,
        });
        return confirmErrorRedirect(
          origin,
          "This confirmation link failed or expired. Request a new email from the sign-up page or log in.",
          "exchange_failed"
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
      logRedirectDestination("pkce", res);
      return noStoreHeaders(res);
    }

    console.log("[auth/confirm] verifyOtp_call", {
      type: SIGNUP_OTP_TYPE,
      token_hash_preview: redactTokenHash(token_hash),
      typeFromQuery,
    });

    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      token_hash: token_hash!,
      type: SIGNUP_OTP_TYPE,
    });

    if (otpError) {
      console.error("[auth/confirm] verifyOtp_result", {
        ok: false,
        message: otpError.message,
        status: otpError.status,
        type: SIGNUP_OTP_TYPE,
      });
      return confirmErrorRedirect(
        origin,
        otpError.message ||
          "This confirmation link failed or expired. Request a new email from the sign-up page.",
        "verify_failed"
      );
    }

    const session = otpData.session;
    const user = otpData.user;
    console.log("[auth/confirm] verifyOtp_result", {
      ok: true,
      userId: user?.id ?? null,
      hasSession: Boolean(session),
      emailConfirmed: Boolean(user?.email_confirmed_at),
      type: SIGNUP_OTP_TYPE,
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
    logRedirectDestination("verifyOtp_signup", res);
    return noStoreHeaders(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[auth/confirm] unhandled_error", {
      message,
      stack: e instanceof Error ? e.stack : undefined,
    });
    return confirmErrorRedirect(
      origin,
      "Something went wrong confirming your email. Try the link again or log in from the sign-up page.",
      "exception"
    );
  }
};
