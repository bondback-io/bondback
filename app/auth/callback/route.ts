import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { upsertMinimalProfileAfterSignup } from "@/lib/actions/onboarding";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { getPostLoginDashboardPath } from "@/lib/auth/post-login-redirect";
import { normalizeProfileRolesFromDb } from "@/lib/profile-roles";

export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeInternalNextPath(searchParams.get("next"), "/dashboard");

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const provider = session.user.app_metadata?.provider;
        if (provider === "google") {
          const meta = session.user.user_metadata ?? {};
          const fullName =
            (typeof meta.full_name === "string" && meta.full_name.trim()) ||
            (typeof meta.name === "string" && meta.name.trim()) ||
            session.user.email?.split("@")[0] ||
            "User";
          const refParam = searchParams.get("ref");
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
            provider === "google"
              ? "/onboarding/role-choice"
              : "/onboarding/complete-profile";
        } else if (!hasNoRole && next === "/dashboard") {
          /** Skip extra `/dashboard` hop — go straight to lister/cleaner home (faster, fewer full reloads). */
          redirectTo = getPostLoginDashboardPath(p);
        }
        return NextResponse.redirect(new URL(redirectTo, origin));
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login", origin));
};
