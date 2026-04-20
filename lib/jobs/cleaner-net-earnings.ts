import { adminJobGrossCents } from "@/lib/admin-job-gross";

/** Job fields needed to subtract lister refunds after partial-refund dispute resolution. */
export type JobRowForCleanerNet = {
  status?: string | null;
  agreed_amount_cents?: number | null;
  dispute_resolution?: string | null;
  refund_amount?: number | null;
  proposed_refund_amount?: number | null;
  counter_proposal_amount?: number | null;
};

/**
 * Cents refunded to the lister from job escrow (partial-refund dispute outcomes).
 * Mirrors job-detail / earnings logic so dashboards stay consistent.
 */
export function listerRefundCentsFromDisputeJob(job: JobRowForCleanerNet): number {
  const st = String(job.status ?? "");
  const dr = String(job.dispute_resolution ?? "");
  const partial =
    dr === "partial_refund_accepted" || dr === "counter_accepted_by_lister";

  if (st === "completed" && partial) {
    const fromRow = Math.max(0, Math.round(Number(job.refund_amount ?? 0) || 0));
    if (fromRow >= 1) return fromRow;
    if (dr === "counter_accepted_by_lister") {
      return Math.max(
        0,
        Math.round(
          Number(job.counter_proposal_amount ?? job.proposed_refund_amount ?? 0) || 0
        )
      );
    }
    return Math.max(
      0,
      Math.round(
        Number(job.proposed_refund_amount ?? job.counter_proposal_amount ?? 0) || 0
      )
    );
  }

  return Math.max(0, Math.round(Number(job.refund_amount ?? 0) || 0));
}

/**
 * What the cleaner actually receives from the job escrow: full bid while in progress;
 * after completion, agreed/bid minus any recorded lister refund from disputes.
 */
export function cleanerNetEarnedCents(
  job: JobRowForCleanerNet,
  listingCurrentLowestBidCents: number | null | undefined
): number {
  const gross = adminJobGrossCents(job, listingCurrentLowestBidCents);
  if (gross <= 0) return 0;
  if (String(job.status ?? "") !== "completed") return gross;
  const refund = listerRefundCentsFromDisputeJob(job);
  return refund >= 1 ? Math.max(0, gross - refund) : gross;
}

/**
 * Lister’s net outlay for a completed job after partial-refund disputes (escrow gross minus refund
 * returned to the lister). Matches job-detail settlement semantics.
 */
export function listerNetSettledSpendCents(
  job: JobRowForCleanerNet,
  listingCurrentLowestBidCents: number | null | undefined
): number {
  const gross = adminJobGrossCents(job, listingCurrentLowestBidCents);
  if (gross <= 0) return 0;
  if (String(job.status ?? "") !== "completed") return gross;
  const refund = listerRefundCentsFromDisputeJob(job);
  return refund >= 1 ? Math.max(0, gross - refund) : gross;
}
