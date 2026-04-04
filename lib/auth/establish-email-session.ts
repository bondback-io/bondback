import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/** Matches `@supabase/ssr` route handler client (third generic differs from bare `SupabaseClient<Database>`). */
type AppSupabaseClient = SupabaseClient<Database, "public", any>;
import { getEmailRedirectAuthCode } from "@/lib/auth/resolve-email-auth-exchange";
import type { EmailOtpType } from "@/lib/auth/resolve-email-otp-type";

type AuthLikeError = { message: string; status?: number; name?: string; code?: string };

export type EstablishEmailSessionMethod = "exchange" | "verifyOtp";

export type EstablishEmailSessionResult =
  | { ok: true; method: EstablishEmailSessionMethod; session: Session; user: User }
  | { ok: false; method: EstablishEmailSessionMethod; error: AuthLikeError };

async function verifyOtpWithEmailSignupFallback(
  supabase: AppSupabaseClient,
  tokenHash: string,
  otpType: EmailOtpType
): Promise<{ data: Awaited<ReturnType<AppSupabaseClient["auth"]["verifyOtp"]>>["data"]; error: AuthLikeError | null }> {
  const first = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: otpType,
  });
  if (!first.error && first.data.session?.user?.id) {
    return { data: first.data, error: null };
  }
  if (otpType === "email" && first.error) {
    const second = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "signup",
    });
    if (!second.error && second.data.session?.user?.id) {
      return { data: second.data, error: null };
    }
    return {
      data: second.data,
      error: (second.error ?? first.error ?? { message: "Unknown" }) as AuthLikeError,
    };
  }
  return {
    data: first.data,
    error: (first.error ?? { message: "Session could not be established." }) as AuthLikeError,
  };
}

function sessionUserFromVerifyData(data: {
  session: Session | null;
  user: User | null;
}): { session: Session; user: User } | null {
  const session = data.session;
  const user = data.user ?? session?.user;
  if (session?.user?.id && user?.id) {
    return { session, user };
  }
  return null;
}

/**
 * PKCE email links use `?code=…` (same-browser only). If exchange fails, `token_hash` + `verifyOtp`
 * can still work cross-device when Supabase includes both in the link or the template uses OTP.
 */
export async function establishSessionFromEmailRedirectParams(
  supabase: AppSupabaseClient,
  params: {
    code: string | null;
    tokenHash: string | null;
    otpType: EmailOtpType;
  }
): Promise<EstablishEmailSessionResult> {
  const code = params.code?.trim() || null;
  const tokenHash = params.tokenHash?.trim() || null;

  const authExchange = getEmailRedirectAuthCode(code, tokenHash);

  if (authExchange) {
    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      authExchange.authCode
    );
    if (!exchangeError && exchangeData.session?.user?.id) {
      return {
        ok: true,
        method: "exchange",
        session: exchangeData.session,
        user: exchangeData.session.user,
      };
    }
    if (exchangeError) {
      const e = exchangeError as AuthLikeError;
      const otpToken = tokenHash;
      if (otpToken && !otpToken.startsWith("pkce_")) {
        const { data, error } = await verifyOtpWithEmailSignupFallback(supabase, otpToken, params.otpType);
        if (!error) {
          const pair = sessionUserFromVerifyData(data);
          if (pair) {
            console.log("[establish-email-session] exchange_failed_verifyOtp_fallback_ok", {
              source: "after_pkce_exchange_error",
            });
            return { ok: true, method: "verifyOtp", session: pair.session, user: pair.user };
          }
        }
      }
      return { ok: false, method: "exchange", error: e };
    }
    return {
      ok: false,
      method: "exchange",
      error: { message: "We couldn’t finish signing you in. Request a new confirmation email or try logging in." },
    };
  }

  if (!tokenHash || tokenHash.startsWith("pkce_")) {
    return {
      ok: false,
      method: "verifyOtp",
      error: { message: "Invalid or missing confirmation link." },
    };
  }

  const { data, error } = await verifyOtpWithEmailSignupFallback(supabase, tokenHash, params.otpType);
  if (!error) {
    const pair = sessionUserFromVerifyData(data);
    if (pair) {
      return { ok: true, method: "verifyOtp", session: pair.session, user: pair.user };
    }
  }
  return { ok: false, method: "verifyOtp", error: error ?? { message: "Unknown" } };
}
