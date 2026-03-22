"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SaveExpoPushTokenResult = { ok: true } | { ok: false; error: string };

/**
 * Save or clear the current user's Expo push token (profiles.expo_push_token).
 * Call from client on app load/login after obtaining the token (e.g. via expo-notifications in Expo Go or standalone).
 */
export async function saveExpoPushToken(token: string | null): Promise<SaveExpoPushTokenResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  const value =
    token === null || token === undefined
      ? null
      : typeof token === "string"
        ? token.trim() || null
        : null;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server error" };
  }

  const { error } = await (admin as any)
    .from("profiles")
    .update({
      expo_push_token: value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.user.id);

  if (error) {
    console.error("[push-token] update failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
