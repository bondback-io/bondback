import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";

export const dynamic = "force-dynamic";

function readTokenHash(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("token_hash") ?? searchParams.get("token");
  if (raw == null) return null;
  const t = raw.trim();
  return t || null;
}

/**
 * Email confirmation — GET only. Use Supabase template with
 * `…/auth/confirm?token_hash={{ .TokenHash }}&type=signup` (OTP). PKCE-only `?code=` links are not handled here.
 * Success path uses {@link redirectAfterAuthSessionEstablished} (role-based dashboard, welcome/tutorial emails).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = readTokenHash(searchParams);

  const redirectPlain = (path: "/login" | "/signup") => NextResponse.redirect(new URL(path, origin));

  if (!token_hash || token_hash.startsWith("pkce_")) {
    return redirectPlain("/login");
  }

  const authCookieResponse = NextResponse.redirect(new URL("/dashboard", origin));
  const supabase = createSupabaseRouteHandlerClient(request, authCookieResponse);

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash,
    type: "signup",
  });

  if (error || !data.session?.user?.id) {
    return redirectPlain("/login");
  }

  return redirectAfterAuthSessionEstablished({
    supabase,
    request,
    next: "/dashboard",
    signupFlow: null,
    refParam: null,
    authCookieResponse,
    sessionFromAuth: data.session,
  });
}
