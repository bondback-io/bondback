type AuthLikeError = { message?: string; status?: number; name?: string; code?: string };

/** Treat as “try again later” — do not revoke sessions or assume user was deleted. */
export function isTransientSupabaseAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as AuthLikeError;
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

/** Admin `getUserById`: only these mean the auth user was removed. */
export function isAuthAdminUserNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as AuthLikeError;
  const code = String(e.code ?? "").toLowerCase();
  if (code === "user_not_found") return true;
  const status = e.status;
  if (status === 404) return true;
  const msg = String(e.message ?? "").toLowerCase();
  return msg.includes("user not found");
}
