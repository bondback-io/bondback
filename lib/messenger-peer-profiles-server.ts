import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export type MessengerPeerProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "id"
  | "full_name"
  | "first_name"
  | "last_name"
  | "cleaner_username"
  | "business_name"
  | "profile_photo_url"
  | "verification_badges"
>;

/** Columns needed for chat labels, sidebar, and avatars — keep tight for audits. */
export const MESSENGER_PEER_PROFILE_SELECT =
  "id, full_name, first_name, last_name, cleaner_username, business_name, profile_photo_url, verification_badges";

/**
 * Load participant profiles for job chat UIs (server-only).
 * Prefer service role so listers see assigned cleaners' names (RLS often limits `profiles` to self).
 */
export async function fetchMessengerPeerProfilesByIds(
  userIds: (string | null | undefined)[]
): Promise<MessengerPeerProfileRow[]> {
  const unique = [
    ...new Set(
      userIds
        .map((u) => String(u ?? "").trim())
        .filter((id) => id.length > 0)
    ),
  ];
  if (unique.length === 0) return [];

  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("profiles")
      .select(MESSENGER_PEER_PROFILE_SELECT)
      .in("id", unique as string[]);
    if (error && process.env.NODE_ENV !== "production") {
      console.warn("[fetchMessengerPeerProfilesByIds]", error.message);
    }
    return (data ?? []) as MessengerPeerProfileRow[];
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(MESSENGER_PEER_PROFILE_SELECT)
    .in("id", unique as string[]);
  if (error && process.env.NODE_ENV !== "production") {
    console.warn("[fetchMessengerPeerProfilesByIds]", error.message);
  }
  return (data ?? []) as MessengerPeerProfileRow[];
}
