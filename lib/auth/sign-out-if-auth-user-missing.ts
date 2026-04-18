import {
  isAuthAdminUserNotFoundError,
  isTransientSupabaseAuthError,
} from "@/lib/auth/supabase-auth-transient";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * When an admin deletes a user from Supabase Auth, browser cookies can still hold a JWT until
 * refresh/validation. If the auth user no longer exists, clear the session so we never treat
 * the user as signed-in or upsert a new `profiles` row for a removed account.
 *
 * **Important:** On transient admin API failures, return true (keep session). The previous
 * behavior signed users out on *any* error — including network blips right after Google OAuth —
 * which surfaced as redirect/login loops.
 */
export async function signOutIfAuthUserMissing(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return true;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (!error && data?.user) return true;

  if (isTransientSupabaseAuthError(error)) {
    console.warn("[signOutIfAuthUserMissing] admin_getUserById_transient", {
      userId,
      message: (error as { message?: string })?.message ?? null,
    });
    return true;
  }

  if (!isAuthAdminUserNotFoundError(error)) {
    console.warn("[signOutIfAuthUserMissing] admin_getUserById_unknown; keeping_session", {
      userId,
      message: (error as { message?: string })?.message ?? null,
    });
    return true;
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return false;
}
