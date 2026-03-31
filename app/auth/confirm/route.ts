import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";

function confirmErrorRedirect(origin: string, message: string) {
  return NextResponse.redirect(
    new URL(`/auth/confirm/error?message=${encodeURIComponent(message)}`, origin)
  );
}

/**
 * Dedicated email-confirmation entry: verifies signup (or other OTP types) and establishes a session,
 * then redirects to the role-based dashboard (or onboarding) via `redirectAfterAuthSessionEstablished`.
 *
 * Configure Supabase "Confirm signup" redirect to this URL, e.g.
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard`
 * (plus `ref` / `flow` if your app adds them from signUp `emailRedirectTo`).
 */
export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const error = searchParams.get("error");
  const error_code = searchParams.get("error_code");
  const error_description = searchParams.get("error_description");

  const next = sanitizeInternalNextPath(searchParams.get("next"), "/dashboard");
  const signupFlow = searchParams.get("flow");
  const refParam = searchParams.get("ref");

  if (error || error_code) {
    const msg =
      error_description?.replace(/\+/g, " ") ||
      error ||
      "Email confirmation was cancelled or could not be completed.";
    return confirmErrorRedirect(origin, msg);
  }

  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("[auth/confirm] exchangeCodeForSession", exchangeError.message);
      return confirmErrorRedirect(
        origin,
        "This confirmation link failed or expired. Request a new email from the sign-up page or log in."
      );
    }
    return redirectAfterAuthSessionEstablished({
      supabase,
      request,
      next,
      signupFlow,
      refParam,
    });
  }

  if (token_hash) {
    const otpType = (typeParam ?? "signup") as
      | "signup"
      | "email"
      | "recovery"
      | "invite"
      | "magiclink"
      | "email_change";

    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash,
      type: otpType,
    });
    if (otpError) {
      console.error("[auth/confirm] verifyOtp", otpError.message);
      return confirmErrorRedirect(
        origin,
        otpError.message ||
          "This confirmation link failed or expired. Request a new email from the sign-up page."
      );
    }
    return redirectAfterAuthSessionEstablished({
      supabase,
      request,
      next,
      signupFlow,
      refParam,
    });
  }

  return confirmErrorRedirect(
    origin,
    "Invalid or missing confirmation link. Open the latest email from Bond Back or request a new confirmation from sign up."
  );
};
