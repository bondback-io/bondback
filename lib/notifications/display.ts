import type { Database } from "@/types/supabase";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

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
