"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { scheduleRouterAction } from "@/lib/deferred-router";
import {
  clearPostLoginNavigationFlag,
  markPostLoginFullPageNavigation,
  shouldSkipSignInSessionRefresh,
} from "@/lib/auth/post-login-navigation-flag";

/** Debounce rapid auth events (OAuth emits several); one coalesced RSC refresh. */
const SIGN_IN_DEBOUNCE_MS = 600;

/** Avoid stacking `router.refresh()` calls (can race with navigation and surface “page couldn’t load” on Vercel). */
const MIN_REFRESH_GAP_MS = 2800;

/**
 * Re-check Supabase Auth with the server (`getUser`) while the tab stays on one route.
 * If an admin deletes the auth user (or the account is removed in the dashboard), cookies can
 * still hold a JWT until the next navigation — `visibilitychange` / polling catches that.
 */
const SESSION_REVALIDATE_POLL_MS = 180_000;
const AUTH_PAGES_PREFIXES = ["/login", "/signup", "/auth/", "/forgot-password", "/reset-password"];

/** OAuth / email link often lands here; defer first `getUser()` check so we don’t sign out mid-handoff. */
const POST_AUTH_SESSION_VALIDATE_DEFER_MS = 750;

function shouldDeferInitialSessionValidation(pathname: string): boolean {
  return (
    pathname.startsWith("/onboarding") ||
    pathname === "/dashboard" ||
    pathname === "/cleaner/dashboard" ||
    pathname === "/lister/dashboard"
  );
}

const SESSION_DEBUG =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

function sessionDebug(message: string, extra?: Record<string, unknown>) {
  if (!SESSION_DEBUG) return;
  console.debug(`[SessionSync] ${message}`, extra ?? {});
}

/**
 * Keeps server-rendered shell (header, layout) aligned with Supabase auth cookies.
 *
 * **Why account switching used to flicker (5–6 refreshes):**
 * 1. `SIGNED_IN` was skipped during the post-login window, but **`USER_UPDATED` was not** — Supabase
 *    emits several `USER_UPDATED` events after sign-in (metadata/profile sync), each scheduling a
 *    debounced `router.refresh()`, so RSC re-fetched repeatedly with partially-settled cookies.
 * 2. `markPostLoginFullPageNavigation()` ran **after** `await signInWithPassword`, so `SIGNED_IN`
 *    could fire **before** the skip flag existed.
 * 3. `SIGNED_OUT` reset `lastRefreshAtRef` to `0`, which broke the min-gap throttle relative to
 *    the next sign-in burst.
 *
 * **Mitigations:** same skip window for `USER_UPDATED` as `SIGNED_IN`; set skip **before** await
 * sign-in; record timestamp on sign-out refresh; clear skip storage on sign-out; dev-only
 * `[SessionSync]` console.debug lines.
 *
 * - **SIGNED_OUT**: refresh + clear post-login flag; soft logout paths should still full-navigate
 *   where possible (see `LogoutButton`).
 * - **SIGNED_IN** / **USER_UPDATED**: debounced refresh; both honour `bb_skip_sign_in_refresh_until`.
 * Skips **INITIAL_SESSION**. Does **not** refresh on `TOKEN_REFRESHED`.
 * - **Tab visible / interval**: `getUser()` so deleted accounts don’t stay “signed in” on long-lived
 *   onboarding tabs without navigation.
 */
export function SessionSync() {
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const offlineRef = useRef(false);
  const validatingRef = useRef(false);

  useEffect(() => {
    /** Before auth events fire: avoid SIGNED_IN vs RoleChoiceClient mount race on iOS (SessionSync runs first in tree). */
    if (pathname.startsWith("/onboarding")) {
      markPostLoginFullPageNavigation();
    }

    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    const syncOfflineFlag = () => {
      offlineRef.current =
        typeof navigator !== "undefined" ? navigator.onLine === false : false;
    };
    syncOfflineFlag();

    async function validateBrowserSession() {
      if (offlineRef.current) {
        sessionDebug("validate skipped while offline");
        return;
      }
      if (validatingRef.current) {
        sessionDebug("validate skipped (already running)");
        return;
      }
      validatingRef.current = true;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      try {
        if (cancelled || !session?.user?.id) return;
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error || !data?.user) {
          const status =
            error && typeof error === "object" && "status" in error
              ? Number((error as { status?: number }).status)
              : NaN;
          if (Number.isFinite(status) && status >= 500 && status < 600) {
            sessionDebug("validate deferred due to 5xx from auth", { status, message: error?.message ?? null });
            return;
          }
          const msg = (error?.message ?? "").toLowerCase();
          const isNetworkLikeError =
            msg.includes("fetch") ||
            msg.includes("network") ||
            msg.includes("timeout") ||
            msg.includes("offline") ||
            msg.includes("503") ||
            msg.includes("502") ||
            msg.includes("504") ||
            msg.includes("gateway") ||
            msg.includes("bad gateway") ||
            msg.includes("service unavailable") ||
            msg.includes("temporar") ||
            msg.includes("unreachable");
          if (offlineRef.current || isNetworkLikeError) {
            sessionDebug("validate deferred due to network/offline", { message: error?.message ?? null });
            return;
          }
          sessionDebug("session cleared — auth user missing or JWT invalid", {
            message: error?.message ?? null,
          });
          await supabase.auth.signOut();
          window.location.assign("/login?message=session_ended");
        }
      } finally {
        validatingRef.current = false;
      }
    }

    let initialValidateTimer: number | null = null;
    if (shouldDeferInitialSessionValidation(pathname)) {
      initialValidateTimer = window.setTimeout(
        () => void validateBrowserSession(),
        POST_AUTH_SESSION_VALIDATE_DEFER_MS
      );
    } else {
      void validateBrowserSession();
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void validateBrowserSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void validateBrowserSession();
    };
    window.addEventListener("pageshow", onPageShow);
    const onOnline = () => {
      syncOfflineFlag();
      void validateBrowserSession();
    };
    const onOffline = () => {
      syncOfflineFlag();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const pollId = window.setInterval(() => void validateBrowserSession(), SESSION_REVALIDATE_POLL_MS);

    const runRefresh = (reason: string) => {
      const now = Date.now();
      if (now - lastRefreshAtRef.current < MIN_REFRESH_GAP_MS) {
        sessionDebug("refresh skipped (gap throttle)", {
          reason,
          gapMs: now - lastRefreshAtRef.current,
        });
        return;
      }
      lastRefreshAtRef.current = now;
      sessionDebug("router.refresh scheduled", { reason });
      scheduleRouterAction(() => {
        try {
          router.refresh();
        } catch {
          /* ignore — router may be tearing down */
        }
      });
    };

    const scheduleSignInRefresh = () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        runRefresh("sign-in debounced");
      }, SIGN_IN_DEBOUNCE_MS);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      /** First hydration with existing session — RSC already matched; skip to avoid extra refresh. */
      if (event === "INITIAL_SESSION") return;
      if (AUTH_PAGES_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
        sessionDebug("auth event ignored on auth route", { event, pathname });
        return;
      }

      sessionDebug("onAuthStateChange", { event, pathname });

      if (event === "SIGNED_OUT") {
        clearPostLoginNavigationFlag();
        if (debounceRef.current != null) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        lastRefreshAtRef.current = Date.now();
        scheduleRouterAction(() => {
          try {
            router.refresh();
          } catch {
            /* ignore */
          }
        });
        return;
      }
      if (event === "SIGNED_IN") {
        if (shouldSkipSignInSessionRefresh()) {
          sessionDebug("SIGNED_IN skipped (post-login full navigation window)", {});
          return;
        }
        /**
         * Full document load to `/onboarding/*` (e.g. email confirm → role-choice) already
         * delivers fresh RSC + cookies. A debounced `router.refresh()` here duplicates work and
         * stalls weak devices / iOS Safari; skip unless user client-navigates from elsewhere.
         */
        if (
          pathname.startsWith("/onboarding") ||
          pathname === "/dashboard" ||
          pathname === "/cleaner/dashboard" ||
          pathname === "/lister/dashboard"
        ) {
          return;
        }
        scheduleSignInRefresh();
        return;
      }
      /**
       * USER_UPDATED fires when metadata/profile syncs after sign-in and can stack multiple
       * refreshes alongside SIGNED_IN. Use the same skip window as full-page login so we do not
       * thrash RSC while cookies + server session converge.
       */
      if (event === "USER_UPDATED") {
        if (shouldSkipSignInSessionRefresh()) {
          sessionDebug("USER_UPDATED skipped (post-login full navigation window)", {});
          return;
        }
        if (
          pathname.startsWith("/onboarding") ||
          pathname === "/dashboard" ||
          pathname === "/cleaner/dashboard" ||
          pathname === "/lister/dashboard"
        ) {
          return;
        }
        scheduleSignInRefresh();
      }
    });
    return () => {
      cancelled = true;
      if (initialValidateTimer != null) window.clearTimeout(initialValidateTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(pollId);
      subscription.unsubscribe();
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    };
  }, [pathname, router]);

  return null;
}
