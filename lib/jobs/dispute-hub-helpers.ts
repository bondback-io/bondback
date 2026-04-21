/**
 * Dispute Resolution hub (/disputes): list vs detail, open vs closed, auto-close on escrow release.
 */

const CLOSED_DISPUTE_STATUSES = new Set(["completed", "cancelled"]);

/** Shared `select` for hub list + detail (keep in sync with RLS-visible columns). */
export const DISPUTE_HUB_JOB_SELECT =
  "id, lister_id, winner_id, status, title, dispute_status, dispute_priority, dispute_escalated, dispute_mediation_status, agreed_amount_cents, updated_at, disputed_at, dispute_reason, dispute_photos, dispute_evidence, dispute_opened_by, proposed_refund_amount, counter_proposal_amount, payment_released_at, dispute_resolution" as const;

/** True if this job row has ever had a formal dispute case worth showing in the hub. */
export function jobQualifiesForDisputeHub(job: {
  disputed_at?: string | null;
  dispute_status?: string | null;
  dispute_reason?: string | null;
  status?: string | null;
}): boolean {
  if (String(job.disputed_at ?? "").trim()) return true;
  if (String(job.dispute_status ?? "").trim()) return true;
  if (String(job.dispute_reason ?? "").trim()) return true;
  const st = String(job.status ?? "");
  if (st === "disputed" || st === "dispute_negotiating" || st === "in_review") return true;
  return false;
}

/** Case is closed for hub sorting / badges (payment settled closes automatically; resolutions mark completed). */
export function isDisputeHubCaseClosed(job: {
  dispute_status?: string | null;
  payment_released_at?: string | null;
  disputed_at?: string | null;
  dispute_reason?: string | null;
}): boolean {
  const ds = String(job.dispute_status ?? "").toLowerCase();
  if (CLOSED_DISPUTE_STATUSES.has(ds)) return true;
  const paid = String(job.payment_released_at ?? "").trim().length > 0;
  if (
    paid &&
    (String(job.disputed_at ?? "").trim() ||
      String(job.dispute_reason ?? "").trim() ||
      (ds.length > 0 && !CLOSED_DISPUTE_STATUSES.has(ds)))
  ) {
    return true;
  }
  return false;
}

/** Fields to set on jobs when escrow pays out and an open dispute case should be archived. */
const SETTLED_DISPUTE_RESOLUTIONS = new Set([
  "partial_refund_accepted",
  "counter_accepted_by_lister",
  "mutual_agreement",
  "partial_refund",
  "release_funds",
  "mediation",
  "refund",
]);

/**
 * Jobs that should appear under “Completed” on lister/cleaner dashboards — includes dispute exits
 * where `status` lagged (`in_review`, etc.) but settlement fields are present, and rows where
 * `dispute_status` was not selected in the query (always include `dispute_status` in `select`).
 */
export function isDashboardCompletedJob(job: {
  status?: string | null;
  dispute_status?: string | null;
  dispute_resolution?: string | null;
  refund_amount?: number | null;
  payment_released_at?: string | null;
  completed_at?: string | null;
}): boolean {
  const s = String(job.status ?? "").trim().toLowerCase();
  const ds = String(job.dispute_status ?? "").trim().toLowerCase();
  /** Only job `status` cancels the row. `dispute_status` may be `cancelled` (e.g. legacy admin paths) while the job is still terminal `completed`. */
  if (s === "cancelled") return false;
  /** Admin / escrow paths set `completed_at` when the job is fully closed — catch status lag. */
  if (String(job.completed_at ?? "").trim().length > 0) return true;
  if (s === "completed") return true;
  if (s === "refunded" || s === "partially_refunded") return true;
  if (ds === "completed") return true;
  /** Admin closed case as resolved (wording varies in DB). */
  if (ds === "resolved" && (s === "completed" || s === "refunded" || s === "partially_refunded")) {
    return true;
  }
  /**
   * Match dispute hub closure: {@link isDisputeHubCaseClosed} treats payout as settled. Mediation /
   * partial-refund paths may set `payment_released_at` while `status` or `dispute_resolution` still
   * lags — lister “My listings” / Completed must still include the job.
   */
  if (String(job.payment_released_at ?? "").trim().length > 0) {
    return true;
  }
  const dr = String(job.dispute_resolution ?? "").toLowerCase();
  if (dr && SETTLED_DISPUTE_RESOLUTIONS.has(dr)) {
    /**
     * If the job row is already terminal, do not require refund_amount / payment_released_at
     * (Stripe persist or webhooks can lag; lister/cleaner should still see Completed).
     * Do not use `dispute_status === resolved` alone — mutual_agreement uses that while still
     * `completed_pending_approval`.
     */
    if (
      s === "completed" ||
      s === "refunded" ||
      s === "partially_refunded" ||
      ds === "completed"
    ) {
      return true;
    }
    const refund = Number(job.refund_amount ?? 0);
    const released = String(job.payment_released_at ?? "").trim().length > 0;
    if (refund >= 1 || released) return true;
  }
  return false;
}

type DashboardJobPhaseFields = Parameters<typeof isDashboardCompletedJob>[0];

/**
 * Jobs that belong in “Active jobs” on lister/cleaner dashboards — includes open disputes and
 * lister-review / escrow pipeline; excludes cancelled and anything already dashboard-complete.
 * (Without this, `disputed` / `in_review` / `dispute_negotiating` rows disappear from both Active and Completed.)
 */
export function isDashboardActivePipelineJob(job: DashboardJobPhaseFields & { status?: string | null }): boolean {
  if (isDashboardCompletedJob(job)) return false;
  const s = String(job.status ?? "").trim().toLowerCase();
  if (s === "cancelled") return false;
  if (
    s === "accepted" ||
    s === "in_progress" ||
    s === "completed_pending_approval" ||
    s === "disputed" ||
    s === "in_review" ||
    s === "dispute_negotiating"
  ) {
    return true;
  }
  /**
   * Assigned jobs must not disappear from both Active and Completed because of an empty/legacy/unknown
   * `status` value (`isDashboardCompletedJob` already returned false).
   */
  return true;
}

/** Cleaner earnings / payout UI: settled job (may lack `payment_released_at` after partial refund). */
export function isCleanerEarningsPaidJob(job: {
  status?: string | null;
  dispute_status?: string | null;
  dispute_resolution?: string | null;
  refund_amount?: number | null;
  payment_released_at?: string | null;
}): boolean {
  if (!isDashboardCompletedJob(job)) return false;
  if (String(job.payment_released_at ?? "").trim()) return true;
  const dr = String(job.dispute_resolution ?? "").toLowerCase();
  if (
    (dr === "partial_refund_accepted" ||
      dr === "counter_accepted_by_lister" ||
      dr === "mutual_agreement" ||
      dr === "mediation" ||
      dr === "refund") &&
    Number(job.refund_amount ?? 0) >= 1
  ) {
    return true;
  }
  return String(job.status ?? "").toLowerCase() === "completed";
}

export function disputeAutoClosePatchOnPaymentRelease(job: {
  disputed_at?: string | null;
  dispute_reason?: string | null;
  dispute_status?: string | null;
}): {
  dispute_status: string;
  dispute_escalated: boolean;
  dispute_mediation_status: string;
} | null {
  const hadCase =
    String(job.disputed_at ?? "").trim().length > 0 ||
    String(job.dispute_reason ?? "").trim().length > 0 ||
    String(job.dispute_status ?? "").trim().length > 0;
  if (!hadCase) return null;
  const st = String(job.dispute_status ?? "").toLowerCase();
  if (CLOSED_DISPUTE_STATUSES.has(st)) return null;
  return {
    dispute_status: "completed",
    dispute_escalated: false,
    dispute_mediation_status: "none",
  };
}
