"use client";

import { useQuery } from "@tanstack/react-query";
import { notificationQueryKeys } from "@/lib/notifications/query-keys";
import { fetchUnreadNotificationCount } from "@/lib/notifications/fetch-unread-count";
import type { ActiveRole } from "@/lib/notifications/notification-role-filter";

/**
 * Accurate unread count for the role-filtered notification list (bell badge, header).
 * Not the same as chat/message unread (`useUnreadNewMessageCount`).
 */
export function useUnreadNotificationCount(
  userId: string | null | undefined,
  activeRole: ActiveRole
) {
  return useQuery({
    queryKey: notificationQueryKeys.unread(userId ?? "", activeRole),
    queryFn: async () => {
      return fetchUnreadNotificationCount(userId!, activeRole);
    },
    enabled: Boolean(userId?.trim()),
    /** Realtime invalidation drives freshness; keep count reactive after inserts/reads. */
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
  });
}
