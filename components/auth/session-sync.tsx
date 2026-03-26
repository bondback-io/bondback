"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { scheduleRouterAction } from "@/lib/deferred-router";

/** Debounce rapid auth events (OAuth emits several); one coalesced RSC refresh. */
const SIGN_IN_DEBOUNCE_MS = 600;

/** Avoid stacking `router.refresh()` calls (can race with navigation and surface “page couldn’t load” on Vercel). */
const MIN_REFRESH_GAP_MS = 2800;

/**
 * Keeps server-rendered shell (header, layout) aligned with Supabase auth cookies.
 * - **SIGNED_OUT**: refresh immediately so logged-out UI shows at once.
 * - **SIGNED_IN** / **USER_UPDATED**: debounced refresh so the top nav shows the user again
 *   after email/password login (client navigation alone can leave RSC cache stale).
 * Skips **INITIAL_SESSION** so normal page loads don’t trigger an extra refresh.
 * Does **not** refresh on `TOKEN_REFRESHED` (too frequent).
 */
export function SessionSync() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    const runRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshAtRef.current < MIN_REFRESH_GAP_MS) {
        return;
      }
      lastRefreshAtRef.current = now;
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
        runRefresh();
      }, SIGN_IN_DEBOUNCE_MS);
    };

    const supabase = createBrowserSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      /** First hydration with existing session — RSC already matched; skip to avoid extra refresh. */
      if (event === "INITIAL_SESSION") return;

      if (event === "SIGNED_OUT") {
        if (debounceRef.current != null) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        lastRefreshAtRef.current = 0;
        scheduleRouterAction(() => {
          try {
            router.refresh();
          } catch {
            /* ignore */
          }
        });
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        scheduleSignInRefresh();
      }
    });
    return () => {
      subscription.unsubscribe();
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    };
  }, [router]);

  return null;
}
