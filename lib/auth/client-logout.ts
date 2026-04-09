"use client";

import type { QueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { clearPostLoginNavigationFlag } from "@/lib/auth/post-login-navigation-flag";
import { MOBILE_NAV_ROLE_STORAGE_KEY } from "@/lib/auth/mobile-nav-role-storage";

export type SignOutAndReloadOptions = {
  /** Clears React Query so cached user-specific data cannot leak after the next login. */
  queryClient?: QueryClient;
  /**
   * Full document load after sign-out so the RSC shell (header avatar, roles) cannot show the
   * previous user. Defaults to `/login` (good for switching accounts on the same device).
   */
  redirectTo?: string;
};

/**
 * Signs out in the browser and forces a full page load. Client-side navigation alone
 * (`router.push`) can leave the server-rendered layout showing the prior user after account
 * switching; a hard navigation guarantees cookies + RSC align with the new session.
 */
export async function signOutAndReloadApp(
  options?: SignOutAndReloadOptions
): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  clearPostLoginNavigationFlag();
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    await supabase.auth.signOut();
  }
  options?.queryClient?.clear();
  try {
    sessionStorage.removeItem(MOBILE_NAV_ROLE_STORAGE_KEY);
  } catch {
    /* private mode */
  }
  const dest = options?.redirectTo?.trim() || "/login";
  window.location.assign(dest);
}
