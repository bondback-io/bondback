import { logClientError } from "@/lib/errors/log-client-error";
import { isLikelyNetworkError } from "@/lib/errors/is-network-error";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type RetryWithBackoffMeta = {
  scope: string;
  attempt: number;
  /** 1-based attempt number */
  attemptNumber: number;
  maxAttempts: number;
  nextDelayMs?: number;
  error: unknown;
  isFinal: boolean;
};

export type RetryWithBackoffOptions = {
  /** Total tries including the first (default 3) */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Portion of delay used as random jitter, e.g. 0.25 = ±25% */
  jitterRatio?: number;
  /** Retry only when this returns true (default: transient network-like errors) */
  shouldRetry?: (error: unknown, attemptIndex: number) => boolean;
  scope?: string;
  /** Called before waiting for the next attempt (not called after final failure) */
  onRetryScheduled?: (info: {
    attemptIndex: number;
    attemptNumber: number;
    maxAttempts: number;
    nextDelayMs: number;
    error: unknown;
  }) => void;
  /** Called after each failed attempt (including the last) */
  onAttemptFailed?: (meta: RetryWithBackoffMeta) => void;
};

/**
 * Exponential backoff with jitter: `min(maxDelay, base * 2^attempt) ± jitter`.
 */
export function computeBackoffDelayMs(
  attemptIndex: number,
  baseDelayMs = 300,
  maxDelayMs = 4000,
  jitterRatio = 0.25
): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attemptIndex);
  const jitter = exp * jitterRatio * (Math.random() * 2 - 1);
  return Math.round(Math.min(maxDelayMs, Math.max(50, exp + jitter)));
}

/**
 * Retries a throwing async operation up to `maxAttempts` times (default **3**),
 * with exponential backoff + jitter between failures.
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options?: RetryWithBackoffOptions
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 300;
  const maxDelayMs = options?.maxDelayMs ?? 4000;
  const jitterRatio = options?.jitterRatio ?? 0.25;
  const shouldRetry =
    options?.shouldRetry ??
    ((err: unknown) => isLikelyNetworkError(err));
  const scope = options?.scope ?? "retryWithBackoff";

  let lastError: unknown;
  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      const attemptNumber = attemptIndex + 1;
      const isFinal = attemptIndex >= maxAttempts - 1;
      logClientError(scope, e, {
        attempt: attemptNumber,
        maxAttempts,
        phase: isFinal ? "final" : "retry",
      });
      options?.onAttemptFailed?.({
        scope,
        attempt: attemptIndex,
        attemptNumber,
        maxAttempts,
        error: e,
        isFinal,
      });
      if (isFinal || !shouldRetry(e, attemptIndex)) {
        throw e;
      }
      const nextDelayMs = computeBackoffDelayMs(
        attemptIndex,
        baseDelayMs,
        maxDelayMs,
        jitterRatio
      );
      options?.onRetryScheduled?.({
        attemptIndex,
        attemptNumber,
        maxAttempts,
        nextDelayMs,
        error: e,
      });
      await sleep(nextDelayMs);
    }
  }
  throw lastError;
}

type OkResult = { ok: true } & Record<string, unknown>;
type ErrResult = { ok: false; error?: string | null } & Record<string, unknown>;

function isErrResult(r: unknown): r is ErrResult {
  return (
    typeof r === "object" &&
    r !== null &&
    "ok" in r &&
    (r as ErrResult).ok === false
  );
}

export type RetryWithBackoffResultOptions<T extends OkResult | ErrResult> =
  RetryWithBackoffOptions & {
    /** When false, return the failed result immediately without further retries */
    shouldRetryResult?: (result: T) => boolean;
  };

/**
 * Same as retries for server actions returning `{ ok: boolean; error?: string }`.
 * Waits between retries using the same backoff + jitter (only when `shouldRetryResult` is true).
 */
export async function retryWithBackoffResult<T extends OkResult | ErrResult>(
  operation: () => Promise<T>,
  options?: RetryWithBackoffResultOptions<T>
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 300;
  const maxDelayMs = options?.maxDelayMs ?? 4000;
  const jitterRatio = options?.jitterRatio ?? 0.25;
  const shouldRetryResult =
    options?.shouldRetryResult ??
    ((result: T) => {
      if (result.ok) return false;
      const errText = isErrResult(result) ? String(result.error ?? "") : "";
      return isLikelyNetworkError(new Error(errText));
    });
  const scope = options?.scope ?? "retryWithBackoffResult";

  let last: T | undefined;
  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex++) {
    const result = await operation();
    last = result;
    if (result.ok) return result;

    const attemptNumber = attemptIndex + 1;
    const errText = isErrResult(result) ? String(result.error ?? "") : "";
    const syntheticErr = new Error(errText || "ok:false");
    logClientError(scope, syntheticErr, {
      attempt: attemptNumber,
      maxAttempts,
      result,
    });
    options?.onAttemptFailed?.({
      scope,
      attempt: attemptIndex,
      attemptNumber,
      maxAttempts,
      error: syntheticErr,
      isFinal: attemptIndex >= maxAttempts - 1,
    });

    if (attemptIndex >= maxAttempts - 1) return result;
    if (!shouldRetryResult(result)) return result;

    const nextDelayMs = computeBackoffDelayMs(
      attemptIndex,
      baseDelayMs,
      maxDelayMs,
      jitterRatio
    );
    options?.onRetryScheduled?.({
      attemptIndex,
      attemptNumber,
      maxAttempts,
      nextDelayMs,
      error: syntheticErr,
    });
    await sleep(nextDelayMs);
  }
  return last as T;
}
