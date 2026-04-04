import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getEmailRedirectAuthCode } from "@/lib/auth/resolve-email-auth-exchange";
import type { EmailOtpType } from "@/lib/auth/resolve-email-otp-type";

function redactTokenHashForLog(token: string | null | undefined): string | null {
  if (token == null || token === "") return null;
  const t = token.trim();
  if (t.length <= 12) return `[len=${t.length}]`;
  return `${t.slice(0, 4)}…${t.slice(-4)} (len=${t.length})`;
}

/** Matches `@supabase/ssr` route handler client (third generic differs from bare `SupabaseClient<Database>`). */
type AppSupabaseClient = SupabaseClient<Database, "public", any>;

type AuthLikeError = { message: string; status?: number; name?: string; code?: string };

export type EstablishEmailSessionMethod = "exchange" | "verifyOtp";

export type EstablishEmailSessionResult =
  | { ok: true; method: EstablishEmailSessionMethod; session: Session; user: User }
  | { ok: false; method: EstablishEmailSessionMethod; error: AuthLikeError };

const TRANSIENT_RETRY_MS = 400;

function isTransientAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as AuthLikeError & { name?: string };
  const name = String(e.name ?? "");
  const msg = String(e.message ?? "").toLowerCase();
  const status = e.status;
  if (name === "AuthRetryableFetchError") return true;
  if (status != null && [408, 429, 500, 502, 503, 504].includes(Number(status))) return true;
  if (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("econnreset") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("try again")
  ) {
    return true;
  }
  return false;
}

function logVerifyOtpResult(
  phase: string,
  otpType: EmailOtpType,
  ms: number,
  result: { data: { session: Session | null; user: User | null }; error: unknown }
): void {
  const err = result.error as AuthLikeError | null | undefined;
  console.log("[auth/confirm] verifyOtp", {
    phase,
    ms,
    otpType,
    ok: !result.error,
    errorMessage: err?.message ?? null,
    errorCode: err?.code ?? null,
    errorName: err?.name ?? null,
    errorStatus: err?.status ?? null,
    sessionUserId: result.data?.session?.user?.id ?? null,
    userId: result.data?.user?.id ?? null,
    emailConfirmedAt: result.data?.user?.email_confirmed_at ?? null,
  });
}

async function verifyOtpWithTransientRetry(
  supabase: AppSupabaseClient,
  tokenHash: string,
  otpType: EmailOtpType,
  phase: string
): Promise<{ data: { session: Session | null; user: User | null }; error: AuthLikeError | null }> {
  const run = async (attempt: 1 | 2) => {
    const t0 = Date.now();
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    logVerifyOtpResult(`${phase}_attempt${attempt}`, otpType, Date.now() - t0, result);
    return result;
  };

  let r = await run(1);
  if (r.error && isTransientAuthError(r.error)) {
    await new Promise((res) => setTimeout(res, TRANSIENT_RETRY_MS));
    r = await run(2);
  }

  return {
    data: r.data,
    error: (r.error ?? null) as AuthLikeError | null,
  };
}

async function verifyOtpWithEmailSignupFallback(
  supabase: AppSupabaseClient,
  tokenHash: string,
  otpType: EmailOtpType
): Promise<{ data: { session: Session | null; user: User | null }; error: AuthLikeError | null }> {
  const first = await verifyOtpWithTransientRetry(supabase, tokenHash, otpType, "primary");

  if (!first.error && first.data.session?.user?.id) {
    return { data: first.data, error: null };
  }

  if (otpType === "email" && first.error) {
    const second = await verifyOtpWithTransientRetry(supabase, tokenHash, "signup", "email_to_signup_fallback");
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

async function exchangeWithTransientRetry(
  supabase: AppSupabaseClient,
  authCode: string,
  source: string
): Promise<{ data: Awaited<ReturnType<AppSupabaseClient["auth"]["exchangeCodeForSession"]>>["data"]; error: AuthLikeError | null }> {
  const run = async (attempt: 1 | 2) => {
    const t0 = Date.now();
    const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
    const err = error as AuthLikeError | null | undefined;
    console.log("[auth/confirm] exchangeCodeForSession", {
      phase: `${source}_attempt${attempt}`,
      ms: Date.now() - t0,
      ok: !error,
      errorMessage: err?.message ?? null,
      errorCode: err?.code ?? null,
      errorName: err?.name ?? null,
      errorStatus: err?.status ?? null,
      sessionUserId: data?.session?.user?.id ?? null,
    });
    return { data, error };
  };

  let { data, error } = await run(1);
  if (error && isTransientAuthError(error)) {
    await new Promise((r) => setTimeout(r, TRANSIENT_RETRY_MS));
    const second = await run(2);
    data = second.data;
    error = second.error;
  }

  return { data, error: (error ?? null) as AuthLikeError | null };
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

  console.log("[auth/confirm] establish_session_params", {
    hasCode: Boolean(code),
    hasTokenHash: Boolean(tokenHash),
    token_hash_preview: redactTokenHashForLog(tokenHash),
    otpType: params.otpType,
  });

  const authExchange = getEmailRedirectAuthCode(code, tokenHash);

  if (authExchange) {
    const { data: exchangeData, error: exchangeError } = await exchangeWithTransientRetry(
      supabase,
      authExchange.authCode,
      authExchange.source
    );
    if (!exchangeError && exchangeData.session?.user?.id) {
      console.log("[auth/confirm] session_created", {
        method: "exchange",
        userId: exchangeData.session.user.id,
      });
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
            console.log("[auth/confirm] session_created", {
              method: "verifyOtp",
              userId: pair.user.id,
              note: "after_pkce_exchange_error",
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
      console.log("[auth/confirm] session_created", { method: "verifyOtp", userId: pair.user.id });
      return { ok: true, method: "verifyOtp", session: pair.session, user: pair.user };
    }
  }
  return { ok: false, method: "verifyOtp", error: error ?? { message: "Unknown" } };
}
