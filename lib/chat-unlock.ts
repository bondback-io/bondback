/**
 * Chat unlock matches server rules in `lib/actions/job-messages.ts`:
 * only after the job is in progress (funds in escrow) or in a post-payment workflow state.
 */
export const CHAT_UNLOCK_STATUSES = [
  "in_progress",
  "completed_pending_approval",
  "completed",
  "disputed",
  "dispute_negotiating",
  "in_review",
] as const;

export type ChatUnlockStatus = (typeof CHAT_UNLOCK_STATUSES)[number];

export function isChatUnlockedForJobStatus(
  status: string | null | undefined
): boolean {
  if (!status) return false;
  return (CHAT_UNLOCK_STATUSES as readonly string[]).includes(status);
}
