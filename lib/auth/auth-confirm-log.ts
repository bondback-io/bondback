/**
 * Shared helpers for `/auth/confirm` logging (route + session establishment).
 * Never log full tokens — only length + short prefix/suffix preview.
 */
export function redactTokenHashForLog(token: string | null | undefined): string | null {
  if (token == null || token === "") return null;
  const t = token.trim();
  if (t.length <= 12) return `[len=${t.length}]`;
  return `${t.slice(0, 4)}…${t.slice(-4)} (len=${t.length})`;
}
