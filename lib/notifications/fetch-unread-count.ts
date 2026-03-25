import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ActiveRole } from "@/lib/notifications/notification-role-filter";
import { filterNotificationsForActiveRole } from "@/lib/notifications/notification-role-filter";
import type { Database } from "@/types/supabase";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

const FALLBACK_LIMIT = 3000;

/**
 * When the RPC is missing or errors, count unread rows client-side using the same
 * role rules as {@link filterNotificationsForActiveRole}. May undercount if there
 * are more than FALLBACK_LIMIT unread rows (extremely rare).
 */
async function fetchUnreadCountFallback(
  userId: string,
  activeRole: ActiveRole
): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(FALLBACK_LIMIT);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as NotificationRow[];
  const filtered = filterNotificationsForActiveRole(rows, activeRole);
  if (process.env.NODE_ENV === "development" && rows.length >= FALLBACK_LIMIT) {
    console.warn(
      "[notifications:unread-count] fallback hit row limit; count may be a lower bound",
      { userId, limit: FALLBACK_LIMIT }
    );
  }
  return filtered.length;
}

/**
 * Server-matched unread count (RLS + role filter). Uses RPC
 * `count_unread_notifications_for_role`; run docs/COUNT_UNREAD_NOTIFICATIONS_FOR_ROLE.sql if it returns 404.
 */
export async function fetchUnreadNotificationCount(
  userId: string,
  activeRole: ActiveRole
): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  type RpcArgs =
    Database["public"]["Functions"]["count_unread_notifications_for_role"]["Args"];
  const rpcArgs: RpcArgs = {
    p_user_id: userId,
    p_active_role: activeRole,
  };
  const { data, error } = await supabase.rpc(
    "count_unread_notifications_for_role",
    rpcArgs as never
  );

  if (!error) {
    const n = data as unknown;
    if (typeof n === "bigint") return Number(n);
    if (typeof n === "number") return n;
    return Number(n ?? 0);
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[notifications:unread-count] RPC unavailable; using client fallback. Apply docs/COUNT_UNREAD_NOTIFICATIONS_FOR_ROLE.sql in Supabase.",
      error.message
    );
  }

  return fetchUnreadCountFallback(userId, activeRole);
}
