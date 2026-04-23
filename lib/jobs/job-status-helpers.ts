/** Job statuses that mean the lister-facing job is cancelled (incl. escrow non-responsive flow). */
export function isJobCancelledStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "cancelled" || s === "cancelled_by_lister";
}

/**
 * PostgREST `.not("status", "in", JOB_STATUS_NOT_IN_LISTING_SLOT)` — job rows that still “hold” a
 * listing for bidding / buy-now (anything else frees the slot).
 */
export const JOB_STATUS_NOT_IN_LISTING_SLOT = "(cancelled,cancelled_by_lister)";
