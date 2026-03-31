import { getPostLoginDashboardPath, type ProfileLike } from "@/lib/auth/post-login-redirect";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/** Re-export for modules that already import from here */
export { shouldUseRoleBasedPostLogin } from "@/lib/auth/post-login-redirect";

/** Matches `@supabase/ssr` browser client (differs from bare `SupabaseClient<Database>` in generics). */
type AppSupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

/** Calm transition before full-page navigation (reduces visual flicker on mobile). */
export const POST_LOGIN_TRANSITION_MS = 380;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Smooth pause after auth before `location.assign` (reduces jarring flashes on mobile). */
export async function runPostLoginTransition(): Promise<void> {
  await delay(POST_LOGIN_TRANSITION_MS);
}

/**
 * Profile row can lag right after sign-in; retry briefly so lister/cleaner dashboard is correct.
 */
export async function fetchPostLoginDestination(
  supabase: AppSupabaseClient,
  userId: string
): Promise<string> {
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("roles, active_role")
      .eq("id", userId)
      .maybeSingle();

    if (!error && profile) {
      return getPostLoginDashboardPath(profile as ProfileLike);
    }
    if (attempt < maxAttempts - 1) {
      await delay(100 * (attempt + 1));
    }
  }
  return "/dashboard";
}

/**
 * Ensures the client session is available (some mobile browsers delay persistence).
 * Prefer getSession() after signIn; subscribe briefly if the session is not yet visible.
 */
export async function waitForSupabaseSessionReady(supabase: AppSupabaseClient): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return;

  await new Promise<void>((resolve, reject) => {
    let subscription: { unsubscribe: () => void } | null = null;
    const timeout = setTimeout(() => {
      subscription?.unsubscribe();
      reject(new Error("Session not ready"));
    }, 12_000);

    const {
      data: { subscription: sub },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (
        nextSession &&
        (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED")
      ) {
        clearTimeout(timeout);
        sub.unsubscribe();
        resolve();
      }
    });
    subscription = sub;
  });
}
