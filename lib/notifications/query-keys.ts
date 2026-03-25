import type { ActiveRole } from "@/lib/notifications/notification-role-filter";

export const notificationQueryKeys = {
  all: ["notifications"] as const,
  user: (userId: string) => ["notifications", "user", userId] as const,
  /** Prefix for invalidating all unread-count queries for a user (any active role). */
  unreadPrefix: (userId: string) => ["notifications", "unread", userId] as const,
  unread: (userId: string, activeRole: ActiveRole) =>
    ["notifications", "unread", userId, activeRole ?? "all"] as const,
};
