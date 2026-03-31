import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";

export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const error = searchParams.get("error");
  const error_code = searchParams.get("error_code");
  const error_description = searchParams.get("error_description");

  const next = sanitizeInternalNextPath(searchParams.get("next"), "/dashboard");
  /** `airtasker` = main `/signup`; `onboarding` = `/onboarding/signup` (role+details before account). */
  const signupFlow = searchParams.get("flow");
  const refParam = searchParams.get("ref");

  if (error || error_code) {
    const msg =
      error_description?.replace(/\+/g, " ") ||
      error ||
      "Sign-in was cancelled or failed. Try again.";
    return NextResponse.redirect(
      new URL(`/login?message=${encodeURIComponent(msg)}`, origin)
    );
  }

  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("[auth/callback] exchangeCodeForSession", exchangeError.message);
      return NextResponse.redirect(
        new URL(
          `/login?message=${encodeURIComponent("This sign-in link failed or expired. Request a new confirmation email or log in.")}`,
          origin
        )
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

  if (token_hash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "email" | "recovery" | "invite" | "magiclink" | "email_change",
    });
    if (otpError) {
      console.error("[auth/callback] verifyOtp", otpError.message);
      return NextResponse.redirect(
        new URL(
          `/login?message=${encodeURIComponent("This confirmation link failed or expired. Request a new email from the sign-up page.")}`,
          origin
        )
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

  return NextResponse.redirect(
    new URL(
      `/login?message=${encodeURIComponent("Invalid or missing confirmation link. Open the latest email from Bond Back or log in.")}`,
      origin
    )
  );
};
