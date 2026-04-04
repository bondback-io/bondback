import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";
import { resolveEmailOtpTypeFromSearchParams } from "@/lib/auth/resolve-email-otp-type";
import { establishSessionFromEmailRedirectParams } from "@/lib/auth/establish-email-session";
import { authPerfDevLog } from "@/lib/auth/auth-perf-dev";
import { redactTokenHashForLog } from "@/lib/auth/auth-confirm-log";

/** Avoid oversized query strings when attaching the original link for “Open in Safari” / copy. */
const MAX_RETRY_URL_PARAM_CHARS = 2048;

/**
 * After `verifyOtp` / `exchangeCodeForSession`, yield so `Set-Cookie` can flush before `getSession()`.
 * Private / restricted browsers may need extra ticks before cookies are readable.
 */
async function waitForAuthCookieSync(): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}

/** Extra short delays for Safari private mode / ITP where cookie jar lags behind verify/exchange. */
async function waitForSessionReadable(maxMs = 450): Promise<void> {
  const delays = [0, 15, 35, 80, 120, 200];
  let acc = 0;
  for (const d of delays) {
    if (acc + d > maxMs) break;
    if (d > 0) await new Promise((r) => setTimeout(r, d));
    acc += d;
    await waitForAuthCookieSync();
  }
}

function noStoreHeaders(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.headers.set("Pragma", "no-cache");
  return res;
}

function logAuthConfirmContext(
  request: NextRequest,
  phase: string,
  extra: Record<string, unknown> = {}
): void {
  const ua = request.headers.get("user-agent") ?? "";
  const chMobile = request.headers.get("sec-ch-ua-mobile");
  const chPlatform = request.headers.get("sec-ch-ua-platform");
  const xfwd = request.headers.get("x-forwarded-for");
  console.log(`[auth/confirm] ${phase}`, {
    ...extra,
    host: request.nextUrl.host,
    uaSnippet: ua.slice(0, 220),
    uaLength: ua.length,
    secChUaMobile: chMobile,
    secChUaPlatform: chPlatform,
    xForwardedForFirst: xfwd?.split(",")[0]?.trim() ?? null,
  });
}

function confirmErrorRedirect(
  origin: string,
  message: string,
  reason?: string,
  emailHint?: string | null,
  retryUrl?: string | null
) {
  const url = new URL("/auth/confirm/error", origin);
  url.searchParams.set("message", message);
  if (reason) url.searchParams.set("reason", reason);
  const trimmed = emailHint?.trim();
  if (trimmed) url.searchParams.set("email", trimmed);
  const r = retryUrl?.trim();
  if (r && r.length <= MAX_RETRY_URL_PARAM_CHARS) {
    url.searchParams.set("retry", r);
  }
  const res = NextResponse.redirect(url);
  return noStoreHeaders(res);
}

/**
 * Read OTP / legacy token from query. `URLSearchParams.get` already applies URL decoding once;
 * do not call `decodeURIComponent` again — it can corrupt tokens that contain `%` or `+` sequences.
 */
function readTokenHashFromRequest(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("token_hash") ?? searchParams.get("token");
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

type AuthLikeError = { message: string; status?: number; name?: string; code?: string };

function mapVerifyOtpFailure(err: AuthLikeError): { userMessage: string; reason: string } {
  const raw = (err.message ?? "").trim();
  const lower = raw.toLowerCase();
  const code = String(err.code ?? "");

  if (
    lower.includes("already been used") ||
    lower.includes("already used") ||
    lower.includes("link has already") ||
    (lower.includes("one-time") && lower.includes("already"))
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

  if (
    lower.includes("storage") ||
    lower.includes("indexeddb") ||
    lower.includes("local storage") ||
    lower.includes("private") ||
    lower.includes("blocked") ||
    lower.includes("not available")
  ) {
    return {
      userMessage:
        "Your browser blocked part of the sign-in step (common in private mode). Try again in a regular Safari or Chrome window, or open the link from a desktop browser.",
      reason: "restricted_browser",
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
  if (mapped.reason === "already_used" || mapped.reason === "restricted_browser") return mapped;

  const raw = (err.message ?? "").trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes("code verifier") ||
    lower.includes("code_verifier") ||
    lower.includes("pkce") ||
    lower.includes("nonces") ||
    lower.includes("nonce")
  ) {
    return {
      userMessage:
        "This link couldn’t finish sign-in in this browser (often the Mail or Gmail in-app browser). Open the same link in Safari or Chrome, or use Copy link on the next screen.",
      reason: "pkce_in_app_browser",
    };
  }

  if (
    lower.includes("could not complete") ||
    lower.includes("couldn't complete") ||
    lower.includes("complete sign-in") ||
    lower.includes("finish sign-in") ||
    lower.includes("not complete") ||
    lower.includes("in-app") ||
    lower.includes("webview") ||
    lower.includes("embedded") ||
    lower.includes("browser may not be supported")
  ) {
    return {
      userMessage:
        "Sign-in couldn’t complete in this browser. Open the link in Safari or Chrome (not the Mail app preview), or paste the link into the address bar.",
      reason: "restricted_browser",
    };
  }

  if (lower.includes("storage") || lower.includes("indexeddb") || lower.includes("private")) {
    return {
      userMessage:
        "Your browser blocked part of sign-in (common in private / incognito mode). Try a normal Safari or Chrome tab.",
      reason: "restricted_browser",
    };
  }

  return {
    userMessage:
      raw ||
      "This sign-in link failed or expired. Request a new confirmation email or log in.",
    reason: "exchange_failed",
  };
}

/**
 * Email confirmation — invoked from GET `/auth/confirm` (and tests).
 */
export async function handleAuthConfirmRequest(request: NextRequest): Promise<NextResponse> {
  const started = Date.now();
  const fullUrl = request.url;
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code")?.trim() || null;
  const token_hash = readTokenHashFromRequest(searchParams);
  const typeFromQuery = searchParams.get("type")?.trim() || null;
  const resolvedOtpType = resolveEmailOtpTypeFromSearchParams(searchParams);

  logAuthConfirmContext(request, "request_incoming", {
    fullUrl: fullUrl.slice(0, 2000),
    pathname: request.nextUrl.pathname,
    hasCode: Boolean(code),
    hasTokenHash: Boolean(token_hash),
    token_hash_preview: redactTokenHashForLog(token_hash),
    token_len: token_hash?.length ?? 0,
    type_raw: typeFromQuery,
    resolvedOtpType,
    queryKeys: [...searchParams.keys()],
  });

  const error = searchParams.get("error");
  const error_code = searchParams.get("error_code");
  const error_description = searchParams.get("error_description");

  const next = sanitizeInternalNextPath(searchParams.get("next"), "/dashboard");
  const signupFlow = searchParams.get("flow");
  const refParam = searchParams.get("ref");
  const emailHint = searchParams.get("email")?.trim() || null;

  try {
    if (error || error_code) {
      const msg =
        error_description?.replace(/\+/g, " ") ||
        error ||
        "Email confirmation was cancelled or could not be completed.";
      console.warn("[auth/confirm] oauth_error", {
        error,
        error_code,
        msg,
        ...{ detail: error_description },
      });
      return confirmErrorRedirect(origin, msg, "oauth_error", emailHint, fullUrl);
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
        emailHint,
        fullUrl
      );
    }

    const authCookieResponse = NextResponse.redirect(new URL("/dashboard", origin));
    noStoreHeaders(authCookieResponse);
    const supabase = createSupabaseRouteHandlerClient(request, authCookieResponse);

    const authT0 = Date.now();
    console.log("[auth/confirm] establish_session_start", {
      hasCode: Boolean(code),
      hasTokenHash: Boolean(token_hash),
      token_hash_preview: redactTokenHashForLog(token_hash),
      typeFromQuery,
      resolvedOtpType,
      token_len: token_hash?.length ?? 0,
    });

    const outcome = await establishSessionFromEmailRedirectParams(supabase, {
      code,
      tokenHash: token_hash,
      otpType: resolvedOtpType,
    });
    authPerfDevLog("auth/confirm:establishSessionFromEmailRedirectParams", {
      ms: Date.now() - authT0,
      ok: outcome.ok,
      method: outcome.method,
    });

    if (!outcome.ok) {
      const e = outcome.error as AuthLikeError;
      if (outcome.method === "exchange") {
        console.error("[auth/confirm] exchangeCodeForSession_failed", {
          message: e.message,
          code: e.code,
          name: e.name,
          status: e.status,
          raw: JSON.stringify(e),
        });
        const { userMessage, reason } = mapExchangeFailure(e);
        return confirmErrorRedirect(origin, userMessage, reason, emailHint, fullUrl);
      }
      console.error("[auth/confirm] verifyOtp_failed", {
        message: e.message,
        code: e.code,
        status: e.status,
        name: e.name,
        typeUsed: resolvedOtpType,
        ms: Date.now() - started,
        raw: JSON.stringify(e),
      });
      const { userMessage, reason } = mapVerifyOtpFailure(e);
      return confirmErrorRedirect(origin, userMessage, reason, emailHint, fullUrl);
    }

    if (outcome.method === "exchange") {
      console.log("[auth/confirm] exchangeCodeForSession_ok", {
        ms: Date.now() - started,
        userId: outcome.session.user.id,
        hasSession: true,
      });

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
        sessionFromAuth: outcome.session,
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

    console.log("[auth/confirm] verifyOtp_ok", {
      userId: outcome.user.id,
      hasSession: true,
      emailConfirmed: Boolean(outcome.user.email_confirmed_at),
      typeUsed: resolvedOtpType,
      ms: Date.now() - started,
    });

    const syncT0 = Date.now();
    await waitForSessionReadable(500);
    authPerfDevLog("auth/confirm:cookieSyncBuffer", { ms: Date.now() - syncT0 });

    let sessionForFinalize = outcome.session;
    if (!sessionForFinalize?.user?.id) {
      const attempts = [0, 50, 120, 200];
      for (const delay of attempts) {
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        const { data: postVerifySession } = await supabase.auth.getSession();
        if (postVerifySession.session?.user?.id) {
          sessionForFinalize = postVerifySession.session;
          logAuthConfirmContext(request, "getSession_retry_ok", { delayMs: delay });
          break;
        }
      }
      if (!sessionForFinalize?.user?.id) {
        console.warn("[auth/confirm] getSession_still_empty_after_retries", {
          delaysMs: attempts,
        });
      }
    }

    const finalizeT0 = Date.now();
    const res = await redirectAfterAuthSessionEstablished({
      supabase,
      request,
      next,
      signupFlow,
      refParam,
      authCookieResponse,
      sessionFromAuth: sessionForFinalize,
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
      name: e instanceof Error ? e.name : typeof e,
    });
    return confirmErrorRedirect(
      origin,
      "Something went wrong confirming your email. Try the link again or log in from the sign-up page.",
      "exception",
      emailHint,
      fullUrl
    );
  }
}
