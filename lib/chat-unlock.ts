/**
 * Chat visibility + messaging rules (see `lib/actions/job-messages.ts`):
 * - Thread is viewable when status is in `CHAT_UNLOCK_STATUSES` (in progress, completed, disputes, …).
 * - New messages are blocked once `payment_released_at` is set (read-only history).
 */
export const CHAT_UNLOCK_STATUSES = [
  "in_progress",
  "completed_pending_approval",
  "completed",
  "disputed",
  "dispute_negotiating",
  "in_review",
] as const;

/**
 * Jobs listed in Messages + floating chat picker. Includes `accepted` (lister picked a cleaner, Pay & Start
 * pending) so threads are not missing right after assignment — chat stays locked until escrow/in_progress
 * (`isChatUnlockedForJobStatus` / `canSendJobChatMessages`).
 */
export const MESSAGES_INBOX_JOB_STATUSES = [
  ...CHAT_UNLOCK_STATUSES,
  "accepted",
] as const;

export type ChatUnlockStatus = (typeof CHAT_UNLOCK_STATUSES)[number];

export function isChatUnlockedForJobStatus(
  status: string | null | undefined
): boolean {
  if (!status) return false;
  return (CHAT_UNLOCK_STATUSES as readonly string[]).includes(status);
}

/** Funds have been released to the cleaner (escrow settled) — chat becomes read-only. */
export function isPaymentReleasedForJob(
  paymentReleasedAt: string | null | undefined
): boolean {
  return typeof paymentReleasedAt === "string" && paymentReleasedAt.trim().length > 0;
}

export type JobChatMessagingArgs = {
  status: string | null | undefined;
  payment_released_at: string | null | undefined;
};

/**
 * Whether the user may send new messages. Thread can still be viewed when false
 * (e.g. after payment release — read-only history).
 */
export function canSendJobChatMessages(job: JobChatMessagingArgs): boolean {
  if (isPaymentReleasedForJob(job.payment_released_at)) return false;
  return isChatUnlockedForJobStatus(job.status);
}
