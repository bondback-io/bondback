import type { Database } from "@/types/supabase";
import { jobDetailPath, listingDetailPath } from "@/lib/marketplace/paths";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

function numFromData(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

/**
 * Deep link for a notification row. Uses `job_id`, then `data.job_id` / `data.listing_id`
 * (e.g. new bid stores listing id in `data` only). Dispute types append `#dispute`.
 * Returns null when there is no in-app destination; otherwise a path starting with `/`.
 */
export function getNotificationHref(row: NotificationRow): string | null {
  const data = row.data as Record<string, unknown> | null;
  if (data?.admin_test === true) return "/notifications";
  if (row.type === "daily_digest") return "/dashboard";

  const jobFromData = data?.job_id != null ? numFromData(data.job_id) : null;
  const jobFromRow = row.job_id != null ? Number(row.job_id) : null;
  /** Only real job PKs — never use legacy numeric `data.listing_id` here (it was not jobs.id). */
  const targetId = jobFromRow ?? jobFromData;
  if (targetId != null && !Number.isNaN(targetId)) {
    const base = jobDetailPath(targetId);
    if (row.type === "dispute_opened" || row.type === "dispute_resolved") {
      return `${base}#dispute`;
    }
    return base;
  }

  const uuidLike = (s: string) =>
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(s);
  const listingUuid =
    typeof data?.listing_uuid === "string" && data.listing_uuid.trim() !== ""
      ? data.listing_uuid.trim()
      : typeof data?.listingId === "string" && data.listingId.trim() !== "" && uuidLike(data.listingId.trim())
        ? data.listingId.trim()
        : null;
  if (listingUuid) {
    return listingDetailPath(listingUuid);
  }

  return null;
}

/** Same as {@link getNotificationHref} but falls back to `/dashboard` when nothing matches. */
export function getNotificationHrefOrDashboard(row: NotificationRow): string {
  return getNotificationHref(row) ?? "/dashboard";
}

function labelForType(type: NotificationRow["type"]): string {
  switch (type) {
    case "job_accepted":
      return "Job accepted";
    case "new_message":
      return "New message";
    case "job_completed":
      return "Job completed";
    case "payment_released":
      return "Payment released";
    case "dispute_opened":
      return "Dispute opened";
    case "dispute_resolved":
      return "Dispute resolved";
    case "job_created":
      return "Job created";
    case "new_bid":
      return "New bid";
    case "job_approved_to_start":
      return "Job approved";
    case "job_cancelled_by_lister":
      return "Job cancelled";
    case "funds_ready":
      return "Funds ready";
    case "referral_reward":
      return "Referral reward";
    case "listing_live":
      return "Listing published";
    case "after_photos_uploaded":
      return "After photos";
    case "auto_release_warning":
      return "Auto-release reminder";
    case "checklist_all_complete":
      return "Checklist";
    case "new_job_in_area":
      return "New job nearby";
    case "job_status_update":
      return "Job status";
    case "early_accept_declined":
      return "Early acceptance";
    case "daily_digest":
      return "Daily digest";
    default:
      return "Update";
  }
}

/** Prefer persisted title; fallback to type label. */
export function getNotificationTitle(row: NotificationRow): string {
  const t = row.title?.trim();
  if (t) return t;
  return labelForType(row.type);
}

/** Prefer persisted body; fallback to legacy message_text. */
export function getNotificationBody(row: NotificationRow): string {
  const b = row.body?.trim();
  if (b) return b;
  return row.message_text ?? "";
}
