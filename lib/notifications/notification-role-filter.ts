import type { Database } from "@/types/supabase";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type ActiveRole = "lister" | "cleaner" | null;

/** Types only ever sent to the listing owner / lister workflow. */
const LISTER_ONLY_TYPES = new Set<NotificationRow["type"]>([
  "new_bid",
  "job_created",
  "funds_ready",
  "listing_live",
  "after_photos_uploaded",
  "auto_release_warning",
  "early_accept_declined",
]);

/** Types only ever sent to the winning cleaner. */
const CLEANER_ONLY_TYPES = new Set<NotificationRow["type"]>([
  "job_accepted",
  "job_approved_to_start",
  "job_cancelled_by_lister",
  "new_job_in_area",
]);

/** Prefer `body` (persisted) then legacy `message_text` — must match SQL unread RPC. */
export function notificationTextForRoleFilter(n: NotificationRow): string {
  const b = (n.body ?? "").trim();
  if (b) return b;
  return (n.message_text ?? "").trim();
}

/**
 * `job_completed` is used for both parties; cleaner copy is only the lister-extended review message.
 */
function jobCompletedVisibleForRole(
  n: NotificationRow,
  activeRole: "lister" | "cleaner"
): boolean {
  const m = notificationTextForRoleFilter(n).toLowerCase();
  const isCleanerCopy = m.includes("the lister extended");
  if (activeRole === "cleaner") return isCleanerCopy;
  return !isCleanerCopy;
}

function jobStatusUpdateVisibleForRole(
  n: NotificationRow,
  activeRole: "lister" | "cleaner"
): boolean {
  const m = notificationTextForRoleFilter(n).toLowerCase();
  if (activeRole === "lister") {
    return !m.includes("the lister extended");
  }
  return (
    !m.includes("you extended") && !m.includes("payment received — escrow")
  );
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
        return jobCompletedVisibleForRole(n, "lister");
      }
      if (n.type === "job_status_update") {
        return jobStatusUpdateVisibleForRole(n, "lister");
      }
      return true;
    }

    if (LISTER_ONLY_TYPES.has(n.type)) return false;
    if (CLEANER_ONLY_TYPES.has(n.type)) return true;
    if (n.type === "job_completed") {
      return jobCompletedVisibleForRole(n, "cleaner");
    }
    if (n.type === "job_status_update") {
      return jobStatusUpdateVisibleForRole(n, "cleaner");
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
