import { adminJobGrossCents, type ListingPriceFallbackCents } from "@/lib/admin-job-gross";
import { isDashboardCompletedJob } from "@/lib/jobs/dispute-hub-helpers";

/** Job fields needed to subtract lister refunds after partial-refund dispute resolution. */
export type JobRowForCleanerNet = {
  status?: string | null;
  agreed_amount_cents?: number | null;
  dispute_status?: string | null;
  dispute_resolution?: string | null;
  refund_amount?: number | null;
  proposed_refund_amount?: number | null;
  counter_proposal_amount?: number | null;
  payment_released_at?: string | null;
  completed_at?: string | null;
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

  if (partial && (st === "completed" || isDashboardCompletedJob(job))) {
    const fromRow = Math.max(0, Math.round(Number(job.refund_amount ?? 0) || 0));
    if (fromRow >= 1) return fromRow;
    const fromProposal =
      dr === "counter_accepted_by_lister"
        ? Math.max(
            0,
            Math.round(
              Number(job.counter_proposal_amount ?? job.proposed_refund_amount ?? 0) || 0
            )
          )
        : Math.max(
            0,
            Math.round(
              Number(job.proposed_refund_amount ?? job.counter_proposal_amount ?? 0) || 0
            )
          );
    if (fromProposal >= 1) return fromProposal;
  }

  const fromRefundCol = Math.max(0, Math.round(Number(job.refund_amount ?? 0) || 0));
  if (fromRefundCol >= 1) return fromRefundCol;

  /**
   * Job detail may load a narrower `select()` that omits `refund_amount` while admin/mediation
   * outcomes still store the cents on `proposed_refund_amount`.
   */
  const settled = st === "completed" || isDashboardCompletedJob(job);
  if (settled) {
    const drLower = dr.trim().toLowerCase();
    const proposedFallbackResolutions = new Set([
      "admin_mediation_final",
      "partial_refund",
    ]);
    if (proposedFallbackResolutions.has(drLower)) {
      const p = Math.max(0, Math.round(Number(job.proposed_refund_amount ?? 0) || 0));
      if (p >= 1) return p;
    }
  }

  return 0;
}

/**
 * What the cleaner actually receives from the job escrow: full bid while in progress;
 * after completion, agreed/bid minus any recorded lister refund from disputes.
 */
function jobIsSettledForNet(job: JobRowForCleanerNet): boolean {
  return isDashboardCompletedJob(job);
}

/**
 * Escrow attribution to the cleaner (minus dispute refunds after settlement).
 * Does not include promo-funded top-ups (`cleaner_bonus_cents_applied`) — use
 * {@link cleanerEarningsIncludingBonusCents} for total earnings shown on payouts.
 */
export function cleanerNetEarnedCents(
  job: JobRowForCleanerNet,
  listingCurrentLowestBidCents: number | null | undefined,
  listingExtras?: ListingPriceFallbackCents | null
): number {
  const gross = adminJobGrossCents(job, listingCurrentLowestBidCents, listingExtras);
  if (gross <= 0) return 0;
  if (!jobIsSettledForNet(job)) return gross;
  const refund = listerRefundCentsFromDisputeJob(job);
  return refund >= 1 ? Math.max(0, gross - refund) : gross;
}

/** Job row fields optional across dashboards — omitted column ⇒ treated as no promo payout recorded. */
export type JobRowWithCleanerBonus = JobRowForCleanerNet & {
  cleaner_bonus_cents_applied?: number | null;
};

/** Whole cents recorded when promo-funded fee reduction applied on release (`jobs.cleaner_bonus_cents_applied`). */
export function jobCleanerBonusCentsApplied(job: JobRowWithCleanerBonus): number {
  const raw = job.cleaner_bonus_cents_applied;
  const n = Math.round(Number(raw ?? 0) || 0);
  return n >= 1 ? n : 0;
}

/**
 * Completed-job earnings shown to cleaners (dashboard CSV / totals): escrow attribution minus dispute refunds,
 * plus any cleaner promo bonus paid via reduced platform fee on release.
 */
export function cleanerEarningsIncludingBonusCents(
  job: JobRowWithCleanerBonus,
  listingCurrentLowestBidCents: number | null | undefined,
  listingExtras?: ListingPriceFallbackCents | null
): number {
  return cleanerNetEarnedCents(job, listingCurrentLowestBidCents, listingExtras) + jobCleanerBonusCentsApplied(job);
}

/**
 * Lister’s net outlay for a completed job after partial-refund disputes (escrow gross minus refund
 * returned to the lister). Matches job-detail settlement semantics.
 */
export function listerNetSettledSpendCents(
  job: JobRowForCleanerNet,
  listingCurrentLowestBidCents: number | null | undefined,
  listingExtras?: ListingPriceFallbackCents | null
): number {
  const gross = adminJobGrossCents(job, listingCurrentLowestBidCents, listingExtras);
  if (gross <= 0) return 0;
  if (!jobIsSettledForNet(job)) return gross;
  const refund = listerRefundCentsFromDisputeJob(job);
  return refund >= 1 ? Math.max(0, gross - refund) : gross;
}
