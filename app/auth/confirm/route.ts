import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";
import { resolveEmailOtpTypeFromSearchParams } from "@/lib/auth/resolve-email-otp-type";

export const dynamic = "force-dynamic";

/**
 * Single buffer after `verifyOtp` / `exchangeCodeForSession` so Supabase `Set-Cookie` on the
 * route `response` is settled before `redirectAfterAuthSessionEstablished` copies cookies onto
 * the redirect. Keeps the browser’s next navigation consistent without stacking multiple delays.
 * Capped at 400ms per product requirements.
 */
const POST_AUTH_COOKIE_SYNC_MS = 280;

async function waitForAuthCookieSync(): Promise<void> {
  await new Promise((r) => setTimeout(r, POST_AUTH_COOKIE_SYNC_MS));
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
 * PKCE flows may send `code` instead.
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
    resolvedOtpType: code ? "pkce_exchange" : resolvedOtpType,
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
      return confirmErrorRedirect(origin, msg, "oauth_error");
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

    if (code) {
      console.log("[auth/confirm] pkce_exchange_start", { code_preview: `${code.slice(0, 8)}…` });
      const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error("[auth/confirm] exchangeCodeForSession_failed", {
          message: exchangeError.message,
          code: (exchangeError as AuthLikeError).code,
          name: exchangeError.name,
          status: exchangeError.status,
        });
        const { userMessage, reason } = mapExchangeFailure(exchangeError as AuthLikeError);
        return confirmErrorRedirect(origin, userMessage, reason, emailHint);
      }

      console.log("[auth/confirm] exchangeCodeForSession_ok", {
        ms: Date.now() - started,
        userId: exchangeData.session?.user?.id ?? null,
        hasSession: Boolean(exchangeData.session),
      });

      await waitForAuthCookieSync();

      const res = await redirectAfterAuthSessionEstablished({
        supabase,
        request,
        next,
        signupFlow,
        refParam,
        authCookieResponse,
        sessionFromAuth: exchangeData.session ?? null,
      });
      console.log("[auth/confirm] redirect_after_session", {
        source: "pkce",
        location: res.headers.get("location"),
      });
      return noStoreHeaders(res);
    }

    console.log("[auth/confirm] verifyOtp_call", {
      type: resolvedOtpType,
      token_hash_preview: redactTokenHash(token_hash),
      typeFromQuery,
    });

    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      token_hash: token_hash!,
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

    await waitForAuthCookieSync();

    const res = await redirectAfterAuthSessionEstablished({
      supabase,
      request,
      next,
      signupFlow,
      refParam,
      authCookieResponse,
      sessionFromAuth: session ?? null,
    });
    console.log("[auth/confirm] redirect_after_session", {
      source: "verifyOtp",
      location: res.headers.get("location"),
    });
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
