import { logClientError } from "@/lib/errors/log-client-error";
import { isLikelyNetworkError } from "@/lib/errors/is-network-error";
import { retryWithBackoff, retryWithBackoffResult } from "@/lib/errors/retry-with-backoff";

export { isLikelyNetworkError } from "@/lib/errors/is-network-error";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * @deprecated Prefer `retryWithBackoff` from `@/lib/errors/retry-with-backoff`.
 * Retries when `maxRetries` (default 2) → **3 attempts** total, using legacy fixed delay.
 */
export async function withNetworkRetries<T>(
  operation: () => Promise<T>,
  options?: {
    maxRetries?: number;
    onRetry?: (attempt: number) => void;
    scope?: string;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const scope = options?.scope ?? "withNetworkRetries";
  let last: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (e) {
      last = e;
      logClientError(scope, e, { attempt });
      if (attempt < maxRetries && isLikelyNetworkError(e)) {
        options?.onRetry?.(attempt + 1);
        await delay(400 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw last;
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

/**
 * @deprecated Prefer `retryWithBackoffResult` from `@/lib/errors/retry-with-backoff`.
 */
export async function withNetworkRetriesResult<T extends OkResult | ErrResult>(
  operation: () => Promise<T>,
  options?: {
    maxRetries?: number;
    onRetry?: (attempt: number) => void;
    scope?: string;
  }
): Promise<T> {
  const maxAttempts = (options?.maxRetries ?? 2) + 1;
  const scope = options?.scope ?? "withNetworkRetriesResult";
  return retryWithBackoffResult(operation, {
    maxAttempts,
    scope,
    onRetryScheduled: ({ attemptNumber }) => {
      options?.onRetry?.(attemptNumber);
    },
  });
}
