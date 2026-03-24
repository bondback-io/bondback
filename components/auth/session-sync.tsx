"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { scheduleRouterAction } from "@/lib/deferred-router";

/**
 * Keeps Next.js Server Components in sync with Supabase auth in the browser.
 * Without this, client sign-in/out can leave the shell (header, layout) showing
 * a stale session until a full reload.
 */
export function SessionSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED" ||
        event === "PASSWORD_RECOVERY"
      ) {
        scheduleRouterAction(() => router.refresh());
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
