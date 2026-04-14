/** Same fields as CreateNotificationOptions — keep aligned when options change. */
export type NotificationPersistOptions = {
  senderName?: string;
  listingId?: number;
  /** Listing PK (string UUID or numeric id from DB). */
  listingUuid?: string | number | null;
  listingTitle?: string | null;
  amountCents?: number | null;
  /** Override generated title (e.g. admin test notification). */
  persistTitle?: string;
  /** Override message_text-based body when persisting. */
  persistBody?: string;
  /** Marks row as an admin test; used for deep links and filtering. */
  adminTest?: boolean;
};

/**
 * Derives title, body, and structured data for persisting notification rows.
 * Pure — no I/O; safe to call from createNotification only.
 */
export function buildNotificationPersistFields(
  type: string,
  jobId: number | null,
  messageText: string,
  options?: NotificationPersistOptions
): { title: string; body: string; data: Record<string, unknown> } {
  const data: Record<string, unknown> = { type };
  if (jobId != null) data.job_id = jobId;
  if (options?.listingId != null) data.listing_id = options.listingId;
  if (options?.listingUuid != null && String(options.listingUuid).trim())
    data.listing_uuid = String(options.listingUuid).trim();
  if (options?.listingTitle != null) data.listing_title = options.listingTitle;
  if (options?.amountCents != null) data.amount_cents = options.amountCents;
  if (options?.senderName != null) data.sender_name = options.senderName;
  if (options?.adminTest) data.admin_test = true;

  let body = messageText ?? "";

  let title: string;
  switch (type) {
    case "new_message":
      title =
        jobId != null
          ? `New message · Job #${jobId}`
          : "New message";
      break;
    case "new_bid":
      title = jobId != null ? `New bid · Job #${jobId}` : "New bid";
      break;
    case "job_accepted":
    case "job_created":
      title = jobId != null ? `Bid accepted · Job #${jobId}` : "Bid accepted";
      break;
    case "job_approved_to_start":
      title = jobId != null ? `Job approved · Job #${jobId}` : "Job approved";
      break;
    case "job_completed":
      title = jobId != null ? `Job complete · Job #${jobId}` : "Job complete";
      break;
    case "payment_released":
      title = jobId != null ? `Payment · Job #${jobId}` : "Payment released";
      break;
    case "dispute_opened":
    case "dispute_resolved":
      title =
        jobId != null ? `Dispute · Job #${jobId}` : "Dispute update";
      break;
    case "job_cancelled_by_lister":
      title = jobId != null ? `Job cancelled · Job #${jobId}` : "Job cancelled";
      break;
    case "listing_cancelled_by_lister":
      title = "Listing ended by owner";
      break;
    case "funds_ready":
      title = "Funds ready";
      break;
    case "referral_reward":
      title = "Referral reward";
      break;
    case "listing_live":
      title = "Listing published";
      break;
    case "after_photos_uploaded":
      title = jobId != null ? `After photos · Job #${jobId}` : "After photos uploaded";
      break;
    case "auto_release_warning":
      title = jobId != null ? `Auto-release soon · Job #${jobId}` : "Auto-release reminder";
      break;
    case "checklist_all_complete":
      title = jobId != null ? `Checklist complete · Job #${jobId}` : "Checklist complete";
      break;
    case "new_job_in_area":
      title = "New job near you";
      break;
    case "job_status_update":
      title = jobId != null ? `Job update · Job #${jobId}` : "Job update";
      break;
    case "early_accept_declined":
      title = "Early acceptance declined";
      break;
    case "daily_digest":
      title = "Daily digest";
      break;
    case "listing_public_comment":
      title = "Public comment";
      break;
    default:
      title = "Update";
  }

  if (options?.persistTitle?.trim()) title = options.persistTitle.trim();
  if (options?.persistBody != null) body = String(options.persistBody);

  return { title, body, data };
}
