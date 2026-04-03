/**
 * Development-only timing logs for auth / onboarding hot paths.
 * No-ops in production (no console noise, no extra work).
 */

export const isAuthPerfDev = process.env.NODE_ENV !== "production";

export function authPerfDevLog(
  label: string,
  payload: Record<string, unknown> & { ms?: number }
): void {
  if (!isAuthPerfDev) return;
  console.info(`[auth:perf] ${label}`, payload);
}

export function authPerfNow(): number {
  return Date.now();
}
