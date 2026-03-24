/** Same fields as CreateNotificationOptions — keep aligned when options change. */
export type NotificationPersistOptions = {
  senderName?: string;
  listingId?: number;
  listingTitle?: string | null;
  amountCents?: number | null;
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
  if (options?.listingTitle != null) data.listing_title = options.listingTitle;
  if (options?.amountCents != null) data.amount_cents = options.amountCents;
  if (options?.senderName != null) data.sender_name = options.senderName;

  const body = messageText ?? "";

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
    case "funds_ready":
      title = "Funds ready";
      break;
    case "referral_reward":
      title = "Referral reward";
      break;
    default:
      title = "Update";
  }

  return { title, body, data };
}
