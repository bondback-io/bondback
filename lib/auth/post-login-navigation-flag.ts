/**
 * While Bond Back performs a full-page navigation after login, SessionSync should not
 * call `router.refresh()` on SIGNED_IN — that revalidates the login route mid-transition
 * and causes visible flicker (especially on mobile).
 */
const STORAGE_KEY = "bb_skip_sign_in_refresh_until";

/** Long enough for slow mobile networks + iOS WebKit after email-link full-page loads. */
const TTL_MS = 12_000;

export function markPostLoginFullPageNavigation(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(Date.now() + TTL_MS));
  } catch {
    /* private mode / quota */
  }
}

export function shouldSkipSignInSessionRefresh(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    if (Number.isNaN(until)) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
    if (Date.now() < until) return true;
    window.sessionStorage.removeItem(STORAGE_KEY);
    return false;
  } catch {
    return false;
  }
}

/** Call on sign-out so the next login can set a fresh skip window (avoids stale TTL). */
export function clearPostLoginNavigationFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
