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
/**
 * Jobs that should appear under “Completed” on lister/cleaner dashboards — includes dispute exits
 * where `status` was left as `refunded` or legacy rows with `dispute_status: completed` only.
 */
export function isDashboardCompletedJob(job: {
  status?: string | null;
  dispute_status?: string | null;
}): boolean {
  const s = String(job.status ?? "").toLowerCase();
  const ds = String(job.dispute_status ?? "").toLowerCase();
  if (s === "cancelled" || ds === "cancelled") return false;
  if (s === "completed") return true;
  if (s === "refunded" || s === "partially_refunded") return true;
  if (ds === "completed") return true;
  return false;
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
