import type { QueryClient } from "@tanstack/react-query";
import { notificationQueryKeys } from "@/lib/notifications/query-keys";
import type { ActiveRole } from "@/lib/notifications/notification-role-filter";

export function invalidateUnreadCountsForUser(
  queryClient: QueryClient,
  userId: string
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: notificationQueryKeys.unreadPrefix(userId),
  });
}

export function decrementUnreadCountCache(
  queryClient: QueryClient,
  userId: string,
  activeRole: ActiveRole
): void {
  queryClient.setQueryData<number>(
    notificationQueryKeys.unread(userId, activeRole),
    (old) => Math.max(0, (old ?? 0) - 1)
  );
}

export function setUnreadCountCacheZero(
  queryClient: QueryClient,
  userId: string,
  activeRole: ActiveRole
): void {
  queryClient.setQueryData<number>(
    notificationQueryKeys.unread(userId, activeRole),
    0
  );
}
