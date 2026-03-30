/**
 * Client-side error logging for debugging. Always includes a stable scope tag.
 */
export function logClientError(
  scope: string,
  error: unknown,
  meta?: Record<string, unknown>
): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[BondBack:${scope}]`, message, {
    ...meta,
    ...(stack ? { stack } : {}),
    error,
  });
}
