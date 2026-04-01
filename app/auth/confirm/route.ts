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

function confirmErrorRedirect(origin: string, message: string) {
  const res = NextResponse.redirect(
    new URL(`/auth/confirm/error?message=${encodeURIComponent(message)}`, origin)
  );
  return noStoreHeaders(res);
}

/**
 * ---------------------------------------------------------------------------
 * Supabase — “Confirm signup” email template (fixes wrong host / vercel.com)
 * ---------------------------------------------------------------------------
 * **Recommended:** `<a href="{{ .ConfirmationURL }}">Confirm your email</a>`
 * (built from `signUp({ emailRedirectTo: 'https://YOUR_DOMAIN/auth/confirm?next=%2Fdashboard' })`).
 *
 * **Alternative:** `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=%2Fdashboard">…</a>`
 *
 * Dashboard → Authentication → URL configuration:
 * - **Redirect URLs:** `https://your-domain/auth/confirm**` (+ localhost for dev).
 * - **Site URL:** your production app origin.
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

  const forwardedHost = request.headers.get("x-forwarded-host");
  console.log("[auth/confirm] GET", {
    origin,
    host: request.nextUrl.host,
    forwardedHost,
    pathname: request.nextUrl.pathname,
    hasCode: Boolean(code),
    hasTokenHash: Boolean(token_hash),
    token_hash_preview: redactTokenHash(token_hash),
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
        hint: "Use {{ .ConfirmationURL }} in Supabase email; add /auth/confirm** to Redirect URLs.",
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
      logRedirectDestination("pkce", res);
      return noStoreHeaders(res);
    }

    /** Email signup: `verifyOtp({ type: 'signup', token_hash })` — default type is `signup`. */
    const otpType = (typeParam ?? "signup") as
      | "signup"
      | "email"
      | "recovery"
      | "invite"
      | "magiclink"
      | "email_change";

    console.log("[auth/confirm] verifyOtp_call", {
      type: otpType,
      token_hash_preview: redactTokenHash(token_hash),
    });

    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      token_hash: token_hash!,
      type: otpType,
    });

    if (otpError) {
      console.error("[auth/confirm] verifyOtp_result", {
        ok: false,
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
    console.log("[auth/confirm] verifyOtp_result", {
      ok: true,
      userId: user?.id ?? null,
      hasSession: Boolean(session),
      emailConfirmed: Boolean(user?.email_confirmed_at),
      type: otpType,
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
    logRedirectDestination("verifyOtp", res);
    return noStoreHeaders(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[auth/confirm] unhandled_error", {
      message,
      stack: e instanceof Error ? e.stack : undefined,
    });
    return confirmErrorRedirect(
      origin,
      "Something went wrong confirming your email. Try the link again or log in from the sign-up page."
    );
  }
};
