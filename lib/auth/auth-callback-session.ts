import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { upsertMinimalProfileAfterSignup } from "@/lib/actions/onboarding";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { getPostLoginDashboardPath } from "@/lib/auth/post-login-redirect";
import { normalizeProfileRolesFromDb } from "@/lib/profile-roles";

type SessionFinalizeParams = {
  /** Matches `@supabase/ssr` server client (differs from bare `SupabaseClient<Database>` generics). */
  supabase: SupabaseClient<Database, "public", any>;
  request: NextRequest;
  /** Sanitized internal path from `next` query (default /dashboard). */
  next: string;
  /** `airtasker` = main `/signup`; `onboarding` = `/onboarding/signup`. */
  signupFlow: string | null;
  refParam: string | null;
};

/**
 * After `exchangeCodeForSession` or `verifyOtp` has established a session, apply profile rules
 * and return the redirect (OAuth Google upsert, banned users, role-based destination).
 */
export async function redirectAfterAuthSessionEstablished(
  params: SessionFinalizeParams
): Promise<NextResponse> {
  const { supabase, request, next: nextRaw, signupFlow, refParam } = params;
  const origin = request.nextUrl.origin;
  const next = sanitizeInternalNextPath(nextRaw, "/dashboard");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL(
        `/login?message=${encodeURIComponent("Could not complete sign-in. Try the link again or log in with your email and password.")}`,
        origin
      )
    );
  }

  const provider = session.user.app_metadata?.provider;
  if (provider === "google") {
    const meta = session.user.user_metadata ?? {};
    const givenName = typeof meta.given_name === "string" ? meta.given_name.trim() : "";
    const familyName = typeof meta.family_name === "string" ? meta.family_name.trim() : "";
    const combinedGivenFamily = `${givenName} ${familyName}`.trim();
    const fullName =
      combinedGivenFamily ||
      (typeof meta.full_name === "string" && meta.full_name.trim()) ||
      (typeof meta.name === "string" && meta.name.trim()) ||
      session.user.email?.split("@")[0] ||
      "User";
    await upsertMinimalProfileAfterSignup({
      full_name: fullName,
      postcode: null,
      referralCode: refParam?.trim() || null,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, banned_reason, roles, active_role")
    .eq("id", session.user.id)
    .maybeSingle();
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
    return NextResponse.redirect(loginUrl);
  }

  const roles = normalizeProfileRolesFromDb(p?.roles ?? null, !!p);
  const hasNoRole = roles.length === 0;
  let redirectTo = next;

  if (hasNoRole && (next === "/dashboard" || next === "/onboarding/role-choice")) {
    redirectTo =
      signupFlow === "onboarding"
        ? "/onboarding/complete-profile"
        : "/onboarding/role-choice";
  } else if (!hasNoRole && next === "/dashboard") {
    redirectTo = getPostLoginDashboardPath(p);
  }

  return NextResponse.redirect(new URL(redirectTo, origin));
}
