import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_banned, banned_reason, roles")
          .eq("id", session.user.id)
          .maybeSingle();
        const p = profile as { is_banned?: boolean; banned_reason?: string | null; roles?: string[] | null } | null;
        if (p?.is_banned) {
          await supabase.auth.signOut();
          const reason = p.banned_reason ? encodeURIComponent(p.banned_reason) : "";
          const loginUrl = new URL("/login", origin);
          loginUrl.searchParams.set("banned", "1");
          if (reason) loginUrl.searchParams.set("reason", reason);
          return NextResponse.redirect(loginUrl);
        }
        const roles = (p?.roles ?? []) as string[];
        const hasNoRole = roles.length === 0;
        let redirectTo = next;
        if (hasNoRole && (next === "/dashboard" || next === "/onboarding/role-choice")) {
          redirectTo = "/onboarding/complete-profile";
        }
        return NextResponse.redirect(new URL(redirectTo, origin));
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login", origin));
};
