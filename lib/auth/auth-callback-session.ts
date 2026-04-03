import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { upsertMinimalProfileAfterSignup } from "@/lib/actions/onboarding";
import { extractGoogleProfileFields } from "@/lib/auth/google-user-metadata";
import { syncGoogleIdentityToProfile } from "@/lib/auth/sync-google-profile";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { getPostLoginDashboardPath } from "@/lib/auth/post-login-redirect";
import { normalizeProfileRolesFromDb } from "@/lib/profile-roles";
import { sendWelcomeEmailAfterEmailVerification } from "@/lib/actions/onboarding-transactional-emails";
import { authPerfDevLog, isAuthPerfDev } from "@/lib/auth/auth-perf-dev";

type SessionFinalizeParams = {
  /** Matches `@supabase/ssr` server client (differs from bare `SupabaseClient<Database>` generics). */
  supabase: SupabaseClient<Database, "public", any>;
  request: NextRequest;
  /** Sanitized internal path from `next` query (default /dashboard). */
  next: string;
  /** `airtasker` = main `/signup`; `onboarding` = `/onboarding/signup`. */
  signupFlow: string | null;
  refParam: string | null;
  /**
   * Route Handler `NextResponse` that was passed to `createSupabaseRouteHandlerClient` so auth
   * cookie writes landed on this object. Outgoing redirects must copy these Set-Cookie headers or
   * the browser never receives a session (user appears logged out → middleware/login).
   */
  authCookieResponse?: NextResponse;
  /**
   * Session returned by `verifyOtp` / `exchangeCodeForSession` in the same request. Route Handler
   * clients read cookies from the **request**; new auth cookies are often only on the **response**
   * until the next round-trip, so `getSession()` can miss the user. Merge this when present.
   */
  sessionFromAuth?: Session | null;
  /**
   * When true (default), send the welcome email once after email verification / OAuth first session.
   * Set false only if you add another caller that must not trigger welcome.
   */
  sendWelcomeEmail?: boolean;
};

/** Copy Supabase auth cookies from the provisional route response onto the real redirect. */
function redirectWithAuthCookies(
  authCookieResponse: NextResponse | undefined,
  destination: URL
): NextResponse {
  if (!authCookieResponse) {
    return NextResponse.redirect(destination);
  }
  const out = NextResponse.redirect(destination);
  const setCookies = authCookieResponse.headers.getSetCookie?.() ?? [];
  for (const line of setCookies) {
    out.headers.append("Set-Cookie", line);
  }
  return out;
}

/**
 * After `exchangeCodeForSession` or `verifyOtp` has established a session, apply profile rules
 * and return the redirect (OAuth Google upsert, banned users, role-based destination).
 */
export async function redirectAfterAuthSessionEstablished(
  params: SessionFinalizeParams
): Promise<NextResponse> {
  const {
    supabase,
    request,
    next: nextRaw,
    signupFlow,
    refParam,
    authCookieResponse,
    sessionFromAuth,
    sendWelcomeEmail = true,
  } = params;
  const origin = request.nextUrl.origin;
  const next = sanitizeInternalNextPath(nextRaw, "/dashboard");
  const callbackT0 = Date.now();

  /** Prefer session from exchange/verify — cookie jar may not be readable yet in this request. */
  let sessionFromCookies: Session | null = null;
  let session: Session | null = sessionFromAuth?.user?.id ? sessionFromAuth : null;
  if (!session?.user?.id) {
    const getSessionT0 = Date.now();
    const {
      data: { session: fromCookie },
    } = await supabase.auth.getSession();
    authPerfDevLog("auth-callback-session:getSession_fallback", {
      ms: Date.now() - getSessionT0,
    });
    sessionFromCookies = fromCookie?.user?.id ? fromCookie : null;
    session = sessionFromCookies;
  }

  if (!session?.user?.id) {
    console.warn("[auth-callback-session] no_session_after_auth", {
      hadCookieSession: Boolean(sessionFromCookies?.user?.id),
      hadSessionFromAuth: Boolean(sessionFromAuth?.user?.id),
    });
    return redirectWithAuthCookies(
      authCookieResponse,
      new URL(
        `/login?message=${encodeURIComponent("Could not complete sign-in. Try the link again or log in with your email and password.")}`,
        origin
      )
    );
  }

  if (!sessionFromCookies?.user?.id && sessionFromAuth?.user?.id) {
    console.info("[auth-callback-session] session_from_auth_fallback", {
      userId: session.user.id,
      note: "getSession had no user; using verifyOtp/exchangeCode session (cookies on response only)",
    });
  }

  const provider = session.user.app_metadata?.provider;
  const upsertT0 = Date.now();
  if (provider === "google") {
    const fields = extractGoogleProfileFields(session.user);
    await upsertMinimalProfileAfterSignup(
      {
        full_name: fields.fullName,
        postcode: null,
        referralCode: refParam?.trim() || null,
        first_name: fields.givenName,
        last_name: fields.familyName,
        avatar_url: fields.pictureUrl,
      },
      { sessionOverride: session }
    );
    await syncGoogleIdentityToProfile(session.user.id, fields);
  } else {
    const meta = session.user.user_metadata ?? {};
    const fullName =
      (typeof meta.full_name === "string" && meta.full_name.trim()) ||
      (typeof meta.name === "string" && meta.name.trim()) ||
      session.user.email?.split("@")[0] ||
      "User";
    const suburb =
      typeof meta.suburb === "string" && meta.suburb.trim() ? meta.suburb.trim() : null;
    const postcode =
      typeof meta.postcode === "string" && meta.postcode.trim() ? meta.postcode.trim() : null;
    await upsertMinimalProfileAfterSignup(
      {
        full_name: fullName,
        suburb,
        postcode,
        referralCode: refParam?.trim() || null,
      },
      { sessionOverride: session }
    );
  }
  authPerfDevLog("auth-callback-session:minimal_profile_upsert", {
    ms: Date.now() - upsertT0,
    provider: provider === "google" ? "google" : "email",
  });

  const profileT0 = Date.now();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, banned_reason, roles, active_role")
    .eq("id", session.user.id)
    .maybeSingle();
  const profileMs = Date.now() - profileT0;
  authPerfDevLog("auth-callback-session:profiles_select", { ms: profileMs });
  if (isAuthPerfDev && profileMs > 800) {
    console.warn("[auth:perf] auth-callback-session:profiles_select_SLOW", { ms: profileMs });
  }
  const p = profile as {
    is_banned?: boolean;
    banned_reason?: string | null;
    roles?: string[] | null;
    active_role?: string | null;
  } | null;

  if (p?.is_banned) {
    await supabase.auth.signOut();
    const reason = p.banned_reason ? encodeURIComponent(p.banned_reason) : "";
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("banned", "1");
    if (reason) loginUrl.searchParams.set("reason", reason);
    return redirectWithAuthCookies(authCookieResponse, loginUrl);
  }

  const roles = normalizeProfileRolesFromDb(p?.roles ?? null, !!p);
  const activeRoleRaw = p?.active_role;
  const hasActiveRole =
    typeof activeRoleRaw === "string" && activeRoleRaw.trim().length > 0;
  /** New signups and anyone who has not chosen a default role yet. */
  const needsRoleChoice = roles.length === 0 || !hasActiveRole;
  let redirectTo = next;

  if (needsRoleChoice && (next === "/dashboard" || next === "/onboarding/role-choice")) {
    redirectTo =
      signupFlow === "onboarding"
        ? "/onboarding/complete-profile"
        : "/onboarding/role-choice";
  } else if (!needsRoleChoice && next === "/dashboard") {
    redirectTo = getPostLoginDashboardPath(p);
  }

  if (sendWelcomeEmail && session.user.id) {
    const userId = session.user.id;
    const sessionForWelcome = session;
    /** Defer so the redirect response is not blocked by Resend / global_settings / prefs reads. */
    setTimeout(() => {
      console.info("[auth-callback-session] email_confirmed_attempting_welcome", {
        userId,
        trigger: "auth_redirect_after_verify",
        note: "deferred",
      });
      void sendWelcomeEmailAfterEmailVerification({
        userId,
        session: sessionForWelcome,
        trigger: "auth_redirect_after_verify",
      })
        .then((result) => {
          console.info("[auth-callback-session] welcome_email_result", {
            userId,
            ok: result.ok,
            skipped: result.skipped,
            error: result.error,
          });
        })
        .catch((e) => {
          console.error("[auth-callback-session] welcome_email_failed", {
            userId,
            message: e instanceof Error ? e.message : String(e),
          });
        });
    }, 0);
  }

  authPerfDevLog("auth-callback-session:total", { ms: Date.now() - callbackT0 });
  return redirectWithAuthCookies(authCookieResponse, new URL(redirectTo, origin));
}
