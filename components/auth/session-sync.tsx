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
 */
export function SessionSync() {
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    /** Before auth events fire: avoid SIGNED_IN vs RoleChoiceClient mount race on iOS (SessionSync runs first in tree). */
    if (pathname.startsWith("/onboarding")) {
      markPostLoginFullPageNavigation();
    }

    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session?.user?.id) return;
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error || !data?.user) {
        sessionDebug("session cleared — auth user missing or JWT invalid", {
          message: error?.message ?? null,
        });
        await supabase.auth.signOut();
        window.location.assign("/login?message=session_ended");
      }
    })();

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
        if (pathname.startsWith("/onboarding")) {
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
        if (pathname.startsWith("/onboarding")) {
          return;
        }
        scheduleSignInRefresh();
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    };
  }, [pathname, router]);

  return null;
}
