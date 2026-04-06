import type { NextRequest } from "next/server";
import { NextResponse, after } from "next/server";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { upsertMinimalProfileAfterSignup } from "@/lib/actions/onboarding";
import { extractGoogleProfileFields } from "@/lib/auth/google-user-metadata";
import { syncGoogleIdentityToProfile } from "@/lib/auth/sync-google-profile";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { getPostLoginDashboardPath } from "@/lib/auth/post-login-redirect";
import { normalizeProfileRolesFromDb } from "@/lib/profile-roles";
import {
  sendTutorialEmailsAfterEmailVerificationIfNeeded,
  sendWelcomeEmailAfterEmailVerification,
} from "@/lib/actions/onboarding-transactional-emails";
import { authPerfDevLog, isAuthPerfDev } from "@/lib/auth/auth-perf-dev";
import { ACCOUNT_INACTIVE_MESSAGE } from "@/lib/auth/account-errors";
import { signOutIfAuthUserMissing } from "@/lib/auth/sign-out-if-auth-user-missing";

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
  /**
   * When `"signup"`, redirect to `/auth/email-confirmed` with a `next` param instead of going
   * straight to the destination (first-time email confirmation from `/auth/confirm` only).
   */
  emailConfirmationKind?: "signup" | null;
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
    emailConfirmationKind = null,
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

  const stillAlive = await signOutIfAuthUserMissing(session.user.id);
  if (!stillAlive) {
    return redirectWithAuthCookies(
      authCookieResponse,
      new URL(`/login?message=session_ended`, origin)
    );
  }

  const loginSessionEnded = () =>
    redirectWithAuthCookies(
      authCookieResponse,
      new URL(`/login?message=session_ended`, origin)
    );

  const provider = session.user.app_metadata?.provider;
  const upsertT0 = Date.now();
  if (provider === "google") {
    const fields = extractGoogleProfileFields(session.user);
    const minimal = await upsertMinimalProfileAfterSignup(
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
    if (!minimal.ok) {
      if (minimal.error === ACCOUNT_INACTIVE_MESSAGE) {
        await supabase.auth.signOut();
        return loginSessionEnded();
      }
      console.warn("[auth-callback-session] minimal_profile_upsert_failed", {
        error: minimal.error,
      });
    }
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
    const stateFromMeta =
      typeof meta.state === "string" && meta.state.trim() ? meta.state.trim().toUpperCase() : null;
    const minimal = await upsertMinimalProfileAfterSignup(
      {
        full_name: fullName,
        state: stateFromMeta,
        suburb,
        postcode,
        referralCode: refParam?.trim() || null,
      },
      { sessionOverride: session }
    );
    if (!minimal.ok) {
      if (minimal.error === ACCOUNT_INACTIVE_MESSAGE) {
        await supabase.auth.signOut();
        return loginSessionEnded();
      }
      console.warn("[auth-callback-session] minimal_profile_upsert_failed", {
        error: minimal.error,
      });
    }
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

  const oauthProvider =
    typeof session.user.app_metadata?.provider === "string"
      ? session.user.app_metadata.provider
      : null;

  if (!needsRoleChoice) {
    if (next === "/dashboard" || next === "/onboarding/google-complete") {
      redirectTo = getPostLoginDashboardPath(p);
    }
  } else if (needsRoleChoice && (next === "/dashboard" || next === "/onboarding/role-choice")) {
    if (signupFlow === "onboarding") {
      redirectTo = "/onboarding/complete-profile";
    } else if (oauthProvider === "google") {
      /** Same Lister/Cleaner + optional ABN UI as sign-up with Google — not legacy role-choice only. */
      redirectTo = "/onboarding/google-complete";
    } else {
      redirectTo = "/onboarding/role-choice";
    }
  }
  /** `needsRoleChoice` + `next === /onboarding/google-complete` keeps `redirectTo` as that URL. */

  /**
   * Welcome + “after verify” tutorial must run only after the user has a real role (or Path 2 metadata).
   * Otherwise Google / email users who still owe a role would get the wrong welcome/tutorial early.
   */
  const skipDeferredTransactionalEmails = needsRoleChoice;

  if (session.user.id) {
    const userId = session.user.id;
    const sessionForEmails = session;
    /**
     * Use `after()` (not `setTimeout`) so transactional email work runs to completion on Vercel
     * serverless — the invocation often ends before a macrotask fires, so welcome email never sent.
     */
    after(async () => {
      if (skipDeferredTransactionalEmails) {
        console.info("[auth-callback-session] skip_deferred_emails", {
          userId,
          reason: "pending_role_choice",
          redirectTo,
        });
        return;
      }
      if (sendWelcomeEmail) {
        console.info("[auth-callback-session] email_confirmed_attempting_welcome", {
          userId,
          trigger: "auth_redirect_after_verify",
          note: "after_response",
        });
        try {
          const result = await sendWelcomeEmailAfterEmailVerification({
            userId,
            session: sessionForEmails,
            trigger: "auth_redirect_after_verify",
          });
          console.info("[auth-callback-session] welcome_email_result", {
            userId,
            ok: result.ok,
            skipped: result.skipped,
            error: result.error,
          });
        } catch (e) {
          console.error("[auth-callback-session] welcome_email_failed", {
            userId,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      try {
        await sendTutorialEmailsAfterEmailVerificationIfNeeded({
          userId,
          session: sessionForEmails,
          trigger: "auth_redirect_after_verify",
        });
      } catch (e) {
        console.error("[auth-callback-session] tutorial_after_verify_failed", {
          userId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    });
  }

  authPerfDevLog("auth-callback-session:total", { ms: Date.now() - callbackT0 });

  let destinationPath = redirectTo;
  if (emailConfirmationKind === "signup") {
    const celebration = new URL("/auth/email-confirmed", origin);
    celebration.searchParams.set("next", redirectTo);
    destinationPath = `${celebration.pathname}${celebration.search}`;
  }

  return redirectWithAuthCookies(authCookieResponse, new URL(destinationPath, origin));
}
