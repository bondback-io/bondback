/**
 * Client-side helpers for Supabase Auth email send / signup rate limits.
 * Does not change auth behaviour — only detection, messaging, and logging.
 */

/** Primary copy when Supabase throttles confirmation emails. */
export const SIGNUP_RATE_LIMIT_MESSAGE =
  "You're trying to sign up too quickly. Please wait a moment and try again.";

/** Short cooldown after a non–rate-limit failure to avoid hammering signUp. */
export const SIGNUP_RETRY_COOLDOWN_MS = 4000;

const RATE_LIMIT_LOG_PREFIX = "[signup:email_rate_limit]";

function redactEmail(msg: string): string {
  return msg.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[email]");
}

/**
 * Detects Supabase “too many emails” / signup rate limit errors from `signUp` / resend flows.
 */
export function isSignupEmailRateLimitError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const e = error as {
    message?: string;
    code?: string;
    status?: number;
    name?: string;
  };
  if (e.code === "over_email_send_rate_limit") return true;
  if (e.status === 429) return true;
  const m = (e.message ?? "").toLowerCase();
  if (m.includes("rate limit") && (m.includes("email") || m.includes("send"))) return true;
  if (m.includes("too many") && m.includes("email")) return true;
  if (m.includes("over_email_send_rate_limit")) return true;
  if (m.includes("email") && m.includes("seconds") && (m.includes("security") || m.includes("only request"))) {
    return true;
  }
  return false;
}

/**
 * Best-effort parse of “try again after N seconds” from Supabase error messages.
 * Returns null if unknown — UI may fall back to a default countdown.
 */
export function parseSignupEmailRetryAfterSeconds(error: unknown): number | null {
  if (error == null || typeof error !== "object") return null;
  const msg = String((error as { message?: string }).message ?? "");
  const m1 = msg.match(/(\d+)\s*seconds?/i);
  if (m1?.[1]) {
    const n = parseInt(m1[1], 10);
    if (Number.isFinite(n) && n > 0 && n < 3600) return n;
  }
  const m2 = msg.match(/after\s+(\d+)\s*second/i);
  if (m2?.[1]) {
    const n = parseInt(m2[1], 10);
    if (Number.isFinite(n) && n > 0 && n < 3600) return n;
  }
  return null;
}

export type SignupRateLimitLogContext = "path2_signUp" | "onboarding_signUp";

/**
 * Server-safe / client-safe logging when a signup email rate limit is hit (observability).
 */
export function logSignupEmailRateLimitHit(context: SignupRateLimitLogContext, error: unknown): void {
  const e = error as { message?: string; code?: string; status?: number };
  console.info(RATE_LIMIT_LOG_PREFIX, {
    context,
    code: e.code ?? null,
    status: e.status ?? null,
    message: e.message ? redactEmail(e.message) : null,
  });
}
