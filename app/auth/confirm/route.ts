import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";
import { resolveEmailOtpTypeFromSearchParams } from "@/lib/auth/resolve-email-otp-type";

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
  console.log("=== CONFIRM ROUTE HIT ===", {
    url: request.url,
    searchParams: Object.fromEntries(request.nextUrl.searchParams),
  });

  const { searchParams, origin } = request.nextUrl;
  const token_hash = readTokenHash(searchParams);
  const type = searchParams.get("type");
  const otpType = resolveEmailOtpTypeFromSearchParams(searchParams);

  console.log("Extracted token_hash:", token_hash, "type:", type);

  /** App uses `/login` as the sign-in page (no `/signin` route). */
  const redirectToSignIn = () => NextResponse.redirect(new URL("/login", origin));

  if (!token_hash || token_hash.startsWith("pkce_")) {
    console.log("Verification failed:", {
      reason: !token_hash ? "missing_token_hash" : "pkce_token_not_supported_here",
    });
    return redirectToSignIn();
  }

  console.log("Calling verifyOtp with:", { type: otpType, token_hash });

  const authCookieResponse = NextResponse.redirect(new URL("/dashboard", origin));
  const supabase = createSupabaseRouteHandlerClient(request, authCookieResponse);

  let data: Awaited<ReturnType<typeof supabase.auth.verifyOtp>>["data"];
  let error: Awaited<ReturnType<typeof supabase.auth.verifyOtp>>["error"];
  try {
    const result = await supabase.auth.verifyOtp({
      token_hash,
      type: otpType,
    });
    data = result.data;
    error = result.error;
  } catch (e) {
    console.log("Verification failed:", e);
    return redirectToSignIn();
  }

  console.log("verifyOtp result:", {
    data: data
      ? {
          hasSession: Boolean(data.session),
          userId: data.user?.id ?? data.session?.user?.id ?? null,
        }
      : null,
    error: error?.message ?? null,
  });

  if (error || !data.session?.user?.id) {
    console.log("Verification failed:", error ?? { message: "no_session_after_verify" });
    return redirectToSignIn();
  }

  const userId = data.session.user.id;
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("active_role")
    .eq("id", userId)
    .maybeSingle();
  const active_role =
    (profileRow as { active_role?: string | null } | null)?.active_role ?? null;

  console.log("Session created successfully, user ID:", userId, "active_role:", active_role);

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
