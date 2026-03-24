import type { Database } from "@/types/supabase";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type ActiveRole = "lister" | "cleaner" | null;

/** Types only ever sent to the listing owner / lister workflow. */
const LISTER_ONLY_TYPES = new Set<NotificationRow["type"]>([
  "new_bid",
  "job_created",
  "funds_ready",
]);

/** Types only ever sent to the winning cleaner. */
const CLEANER_ONLY_TYPES = new Set<NotificationRow["type"]>([
  "job_accepted",
  "job_approved_to_start",
  "job_cancelled_by_lister",
]);

/**
 * `job_completed` is used for both parties; cleaner copy is only the lister-extended review message.
 */
function jobCompletedVisibleForRole(
  message: string,
  activeRole: "lister" | "cleaner"
): boolean {
  const m = (message || "").toLowerCase();
  const isCleanerCopy = m.includes("the lister extended");
  if (activeRole === "cleaner") return isCleanerCopy;
  return !isCleanerCopy;
}

/**
 * When a user has both lister and cleaner roles, only show notifications relevant to the
 * active role (header role switcher).
 */
export function filterNotificationsForActiveRole(
  notifications: NotificationRow[],
  activeRole: ActiveRole
): NotificationRow[] {
  if (activeRole == null) return notifications;

  return notifications.filter((n) => {
    if (activeRole === "lister") {
      if (CLEANER_ONLY_TYPES.has(n.type)) return false;
      if (n.type === "job_completed") {
        return jobCompletedVisibleForRole(n.message_text ?? "", "lister");
      }
      return true;
    }

    if (LISTER_ONLY_TYPES.has(n.type)) return false;
    if (CLEANER_ONLY_TYPES.has(n.type)) return true;
    if (n.type === "job_completed") {
      return jobCompletedVisibleForRole(n.message_text ?? "", "cleaner");
    }
    return true;
  });
}

/** Merge realtime row into a list without duplicate ids (same insert delivered twice, or race with fetch). */
export function prependNotificationDeduped(
  prev: NotificationRow[],
  row: NotificationRow,
  limit: number
): NotificationRow[] {
  const without = prev.filter((p) => p.id !== row.id);
  return [row, ...without].slice(0, limit);
}
