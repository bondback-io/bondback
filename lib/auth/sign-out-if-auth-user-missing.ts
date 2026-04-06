import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * When an admin deletes a user from Supabase Auth, browser cookies can still hold a JWT until
 * refresh/validation. If the auth user no longer exists, clear the session so we never treat
 * the user as signed-in or upsert a new `profiles` row for a removed account.
 */
export async function signOutIfAuthUserMissing(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return true;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (!error && data?.user) return true;
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return false;
}
