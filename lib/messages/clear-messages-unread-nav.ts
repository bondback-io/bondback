"use client";

import type { QueryClient } from "@tanstack/react-query";
import { markAllNewMessageNotificationsRead } from "@/lib/actions/notifications";
import { CLEAR_MESSAGES_UNREAD_NAV_EVENT } from "@/lib/messages/messages-unread-events";
import { notificationQueryKeys } from "@/lib/notifications/query-keys";

/**
 * Clears unread `new_message` notifications when the user opens Messages from nav,
 * resets the messages badge, and syncs React Query notification caches.
 */
export async function clearMessagesUnreadForNav(
  queryClient: QueryClient,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await markAllNewMessageNotificationsRead();
  if (res.ok) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CLEAR_MESSAGES_UNREAD_NAV_EVENT));
    }
    void queryClient.invalidateQueries({
      queryKey: notificationQueryKeys.unreadPrefix(userId),
    });
    void queryClient.invalidateQueries({
      queryKey: notificationQueryKeys.user(userId),
    });
  }
  return res;
}
