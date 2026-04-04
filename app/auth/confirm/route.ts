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

function loginWithMessage(origin: string, message: string) {
  return NextResponse.redirect(
    new URL(`/login?message=${encodeURIComponent(message)}`, origin)
  );
}

/**
 * Email confirmation — GET only. Expects Supabase “Confirm signup” email to use
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` (OTP), not PKCE `code` alone.
 * Welcome + tutorial emails run inside {@link redirectAfterAuthSessionEstablished} (deferred).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const oauthErr = searchParams.get("error") ?? searchParams.get("error_code");
  if (oauthErr) {
    const desc = searchParams.get("error_description")?.replace(/\+/g, " ") ?? oauthErr;
    return loginWithMessage(origin, desc);
  }

  const token_hash = readTokenHash(searchParams);
  if (!token_hash) {
    return loginWithMessage(
      origin,
      "Invalid confirmation link. Use the latest email from Bond Back or sign up again."
    );
  }

  if (token_hash.startsWith("pkce_")) {
    return loginWithMessage(
      origin,
      "Open the confirmation link from your email (token link), or sign up again in this browser."
    );
  }

  const authCookieResponse = NextResponse.redirect(new URL("/dashboard", origin));
  const supabase = createSupabaseRouteHandlerClient(request, authCookieResponse);

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash,
    type: "signup",
  });

  if (error || !data.session?.user?.id) {
    return loginWithMessage(
      origin,
      error?.message?.trim() || "Invalid or expired confirmation link. Try signing up again or log in."
    );
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
