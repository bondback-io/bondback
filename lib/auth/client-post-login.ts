import { getPostLoginDashboardPath } from "@/lib/auth/post-login-redirect";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/** Matches `@supabase/ssr` browser client (differs from bare `SupabaseClient<Database>` in generics). */
type AppSupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

/**
 * After login, use role-based routing unless `next` is a real deep link (e.g. /jobs).
 * Treat `/login` (and default /dashboard) as “no deep link” so we never loop back to login.
 */
export function shouldUseRoleBasedPostLogin(next: string): boolean {
  if (next === "/dashboard" || next === "/") return true;
  const pathOnly = next.split("?")[0] ?? "";
  return pathOnly === "/login";
}

export async function fetchPostLoginDestination(
  supabase: AppSupabaseClient,
  userId: string
): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("roles, active_role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return "/dashboard";
  }
  return getPostLoginDashboardPath(profile);
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
