import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";
import { resolveEmailOtpTypeFromSearchParams } from "@/lib/auth/resolve-email-otp-type";
import { getEmailRedirectAuthCode } from "@/lib/auth/resolve-email-auth-exchange";
import { authPerfDevLog } from "@/lib/auth/auth-perf-dev";

export const dynamic = "force-dynamic";

/**
 * After `verifyOtp` / `exchangeCodeForSession`, yield so the route handler’s `Set-Cookie` writes
 * can flush before `redirectAfterAuthSessionEstablished` merges cookies onto the redirect response.
 * Microtask + 0ms timer (no fixed 50ms buffer — reduces perceived stall on mobile Safari).
 */
async function waitForAuthCookieSync(): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function noStoreHeaders(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.headers.set("Pragma", "no-cache");
  return res;
}

function redactTokenHash(token: string | null): string | null {
  if (!token) return null;
  if (token.length <= 12) return `[len=${token.length}]`;
  return `${token.slice(0, 4)}…${token.slice(-4)} (len=${token.length})`;
}

function confirmErrorRedirect(
  origin: string,
  message: string,
  reason?: string,
  /** Forward from confirm link `?email=` when present so the error page can prefill resend. */
  emailHint?: string | null
) {
  const url = new URL("/auth/confirm/error", origin);
  url.searchParams.set("message", message);
  if (reason) url.searchParams.set("reason", reason);
  const trimmed = emailHint?.trim();
  if (trimmed) url.searchParams.set("email", trimmed);
  const res = NextResponse.redirect(url);
  return noStoreHeaders(res);
}

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

type AuthLikeError = { message: string; status?: number; name?: string; code?: string };

/**
 * Map Supabase Auth errors to a safe user message + query reason.
 * Same English copy may be used for "expired" vs "reused" in some Auth versions — we still try keywords.
 */
function mapVerifyOtpFailure(err: AuthLikeError): { userMessage: string; reason: string } {
  const raw = (err.message ?? "").trim();
  const lower = raw.toLowerCase();
  const code = String(err.code ?? "");

  if (
    lower.includes("already been used") ||
    lower.includes("already used") ||
    lower.includes("link has already") ||
    lower.includes("one-time") && lower.includes("already")
  ) {
    return {
      userMessage:
        "This link has already been used. Please log in with your email and password.",
      reason: "already_used",
    };
  }

  if (code === "otp_expired" || lower.includes("expired")) {
    return {
      userMessage:
        "This confirmation link has expired. Request a new confirmation email from the sign-up page.",
      reason: "verify_failed",
    };
  }

  return {
    userMessage:
      raw ||
      "This confirmation link is invalid or has expired. Request a new email from the sign-up page or log in.",
    reason: "verify_failed",
  };
}

function mapExchangeFailure(err: AuthLikeError): { userMessage: string; reason: string } {
  const mapped = mapVerifyOtpFailure(err);
  if (mapped.reason === "already_used") return mapped;
  const lower = (err.message ?? "").toLowerCase();
  if (
    lower.includes("code verifier") ||
    lower.includes("code_verifier") ||
    lower.includes("pkce")
  ) {
    return {
      userMessage:
        "This link could not complete sign-in in this browser. Open the link in Safari or Chrome (not the in-app preview), or request a new confirmation email from the sign-up page.",
      reason: "pkce_verifier_missing",
    };
  }
  return {
    userMessage:
      err.message?.trim() ||
      "This sign-in link failed or expired. Request a new confirmation email or log in.",
    reason: "exchange_failed",
  };
}

/**
 * Email confirmation — GET only.
 * Supabase redirects here with `token_hash` + `type` (use `type=signup` in the email template — see project docs / handoff).
 * PKCE flows send `?code=…` **or** `?token_hash=pkce_…` (same auth code; must use
 * `exchangeCodeForSession`, not `verifyOtp`).
 *
 * After `verifyOtp` / `exchangeCodeForSession`, the user is logged in and redirected in one response.
 * `next` (default `/dashboard`) is passed to `redirectAfterAuthSessionEstablished`, which resolves the
 * final path (e.g. `/lister/dashboard` or `/cleaner/dashboard` when profile roles are already set — Path 2).
 * No extra client page; cookie sync stays a single event-loop turn so the redirect stays fast on mobile.
 */
export async function GET(request: NextRequest) {
  const started = Date.now();
  const fullUrl = request.url;
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code")?.trim() || null;
  const token_hash = readTokenHashFromRequest(searchParams);
  const typeFromQuery = searchParams.get("type")?.trim() || null;
  const resolvedOtpType = resolveEmailOtpTypeFromSearchParams(searchParams);

  const error = searchParams.get("error");
  const error_code = searchParams.get("error_code");
  const error_description = searchParams.get("error_description");

  const next = sanitizeInternalNextPath(searchParams.get("next"), "/dashboard");
  /** `onboarding` | `path2` | other — forwarded to `redirectAfterAuthSessionEstablished` (e.g. path2 = combined signup). */
  const signupFlow = searchParams.get("flow");
  const refParam = searchParams.get("ref");
  const emailHint = searchParams.get("email")?.trim() || null;

  console.log("[auth/confirm] GET incoming", {
    fullUrl: fullUrl.slice(0, 2000),
    host: request.nextUrl.host,
    pathname: request.nextUrl.pathname,
    forwardedHost: request.headers.get("x-forwarded-host"),
    hasCode: Boolean(code),
    hasTokenHash: Boolean(token_hash),
    token_hash_preview: redactTokenHash(token_hash),
    typeFromQuery,
    resolvedOtpType: getEmailRedirectAuthCode(code, token_hash)
      ? "pkce_exchange"
      : resolvedOtpType,
    next,
    queryKeys: [...searchParams.keys()],
  });

  try {
    if (error || error_code) {
      const msg =
        error_description?.replace(/\+/g, " ") ||
        error ||
        "Email confirmation was cancelled or could not be completed.";
      console.warn("[auth/confirm] oauth_error", { error, error_code, msg });
      return confirmErrorRedirect(origin, msg, "oauth_error", emailHint);
    }

    if (!code && !token_hash) {
      console.warn("[auth/confirm] missing_code_and_token", {
        hint: "Use {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup in the Supabase template, or PKCE ?code=…",
        queryKeys: [...searchParams.keys()],
      });
      return confirmErrorRedirect(
        origin,
        "This confirmation link is missing a token. Open the latest email from Bond Back, or request a new confirmation link from the sign-up page.",
        "missing_token",
        emailHint
      );
    }

    const authCookieResponse = NextResponse.redirect(new URL("/dashboard", origin));
    noStoreHeaders(authCookieResponse);
    const supabase = createSupabaseRouteHandlerClient(request, authCookieResponse);

    const authExchange = getEmailRedirectAuthCode(code, token_hash);

    if (authExchange) {
      console.log("[auth/confirm] exchangeCodeForSession_start", {
        source: authExchange.source,
        code_preview: `${authExchange.authCode.slice(0, 8)}…`,
      });
      const pkceT0 = Date.now();
      const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        authExchange.authCode
      );
      authPerfDevLog("auth/confirm:exchangeCodeForSession", {
        ms: Date.now() - pkceT0,
        ok: !exchangeError,
        source: authExchange.source,
      });

      if (exchangeError) {
        console.error("[auth/confirm] exchangeCodeForSession_failed", {
          message: exchangeError.message,
          code: (exchangeError as AuthLikeError).code,
          name: exchangeError.name,
          status: exchangeError.status,
          source: authExchange.source,
        });
        const { userMessage, reason } = mapExchangeFailure(exchangeError as AuthLikeError);
        return confirmErrorRedirect(origin, userMessage, reason, emailHint);
      }

      console.log("[auth/confirm] exchangeCodeForSession_ok", {
        ms: Date.now() - started,
        userId: exchangeData.session?.user?.id ?? null,
        hasSession: Boolean(exchangeData.session),
        source: authExchange.source,
      });

      if (!exchangeData.session?.user?.id) {
        console.error("[auth/confirm] exchange_ok_but_no_user");
        return confirmErrorRedirect(
          origin,
          "We couldn’t finish signing you in. Request a new confirmation email or try logging in.",
          "exchange_failed",
          emailHint
        );
      }

      const syncPkceT0 = Date.now();
      await waitForAuthCookieSync();
      authPerfDevLog("auth/confirm:cookieSyncBuffer", { ms: Date.now() - syncPkceT0 });

      const finalizePkceT0 = Date.now();
      const res = await redirectAfterAuthSessionEstablished({
        supabase,
        request,
        next,
        signupFlow,
        refParam,
        authCookieResponse,
        sessionFromAuth: exchangeData.session ?? null,
      });
      authPerfDevLog("auth/confirm:redirectAfterAuthSessionEstablished", {
        ms: Date.now() - finalizePkceT0,
        source: "pkce",
      });
      console.log("[auth/confirm] redirect_after_session", {
        source: "pkce",
        location: res.headers.get("location"),
      });
      authPerfDevLog("auth/confirm:GET_total", { ms: Date.now() - started });
      return noStoreHeaders(res);
    }

    if (!token_hash) {
      console.error("[auth/confirm] verifyOtp_missing_token_hash");
      return confirmErrorRedirect(
        origin,
        "This confirmation link is missing a token. Open the latest email from Bond Back, or request a new confirmation link from the sign-up page.",
        "missing_token",
        emailHint
      );
    }

    console.log("[auth/confirm] verifyOtp_call", {
      type: resolvedOtpType,
      token_hash_preview: redactTokenHash(token_hash),
      typeFromQuery,
    });

    const verifyT0 = Date.now();
    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      token_hash,
      type: resolvedOtpType,
    });
    authPerfDevLog("auth/confirm:verifyOtp", {
      ms: Date.now() - verifyT0,
      ok: !otpError,
      type: resolvedOtpType,
    });

    if (otpError) {
      console.error("[auth/confirm] verifyOtp_failed", {
        message: otpError.message,
        code: (otpError as AuthLikeError).code,
        status: otpError.status,
        name: otpError.name,
        typeUsed: resolvedOtpType,
        ms: Date.now() - started,
      });
      const { userMessage, reason } = mapVerifyOtpFailure(otpError as AuthLikeError);
      return confirmErrorRedirect(origin, userMessage, reason, emailHint);
    }

    const session = otpData.session;
    const user = otpData.user;
    console.log("[auth/confirm] verifyOtp_ok", {
      userId: user?.id ?? null,
      hasSession: Boolean(session),
      emailConfirmed: Boolean(user?.email_confirmed_at),
      typeUsed: resolvedOtpType,
      ms: Date.now() - started,
    });

    const syncT0 = Date.now();
    await waitForAuthCookieSync();
    authPerfDevLog("auth/confirm:cookieSyncBuffer", { ms: Date.now() - syncT0 });

    const finalizeT0 = Date.now();
    const res = await redirectAfterAuthSessionEstablished({
      supabase,
      request,
      next,
      signupFlow,
      refParam,
      authCookieResponse,
      sessionFromAuth: session ?? null,
    });
    authPerfDevLog("auth/confirm:redirectAfterAuthSessionEstablished", {
      ms: Date.now() - finalizeT0,
      source: "verifyOtp",
    });
    console.log("[auth/confirm] redirect_after_session", {
      source: "verifyOtp",
      location: res.headers.get("location"),
    });
    authPerfDevLog("auth/confirm:GET_total", { ms: Date.now() - started });
    return noStoreHeaders(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[auth/confirm] unhandled_exception", {
      message,
      stack: e instanceof Error ? e.stack : undefined,
    });
    return confirmErrorRedirect(
      origin,
      "Something went wrong confirming your email. Try the link again or log in from the sign-up page.",
      "exception",
      emailHint
    );
  }
}
