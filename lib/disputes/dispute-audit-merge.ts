import type { SerializableDisputeMessage } from "@/lib/disputes/serialize-dispute-messages";
import { coerceDisputePhotoUrls } from "@/lib/disputes/coerce-dispute-photo-urls";

type JobFieldsForLegacyAudit = {
  id: number;
  dispute_reason?: string | null;
  disputed_at?: string | null;
  proposed_refund_amount?: number | null;
  dispute_photos?: string[] | null;
  dispute_evidence?: string[] | null;
};

/**
 * When `dispute_messages` has no rows (e.g. dispute opened before thread logging),
 * synthesize a single system entry from the formal case on `jobs` so admins and users still see the submission.
 */
export function mergeOpeningMessageFromJobIfMissing(
  job: JobFieldsForLegacyAudit,
  messages: SerializableDisputeMessage[]
): SerializableDisputeMessage[] {
  if (messages.length > 0) return messages;

  const reason = String(job.dispute_reason ?? "").trim();
  const hasTime = Boolean(job.disputed_at);
  if (!reason && !hasTime) return messages;

  const evidenceUrls = coerceDisputePhotoUrls(
    job.dispute_evidence,
    job.dispute_photos
  ).slice(0, 12);

  const lines: string[] = ["Original dispute submission (case record on file; no separate thread row exists)."];
  if (reason) lines.push(reason);
  const cents = Math.max(0, Number(job.proposed_refund_amount ?? 0));
  if (cents > 0) lines.push(`Proposed refund at open: $${(cents / 100).toFixed(2)}`);

  const base: SerializableDisputeMessage = {
    id: `legacy-case-${job.id}`,
    body: lines.join("\n\n"),
    author_role: "system",
    created_at:
      job.disputed_at && String(job.disputed_at).trim()
        ? typeof job.disputed_at === "string"
          ? job.disputed_at
          : new Date(job.disputed_at as string).toISOString()
        : new Date(0).toISOString(),
    is_escalation_event: false,
  };

  if (evidenceUrls.length > 0) return [{ ...base, attachment_urls: evidenceUrls }];
  return [base];
}
