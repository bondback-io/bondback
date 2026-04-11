/**
 * Marketplace detail URLs:
 * - `/listings/[uuid]` — live/bidding / no assignee yet (or job not in assigned work state)
 * - `/jobs/[numericId]` — assigned / in-progress job row
 *
 * Jobs table uses `winner_id` (assigned cleaner). Some call sites may pass `cleaner_id` as an alias.
 */

export type ListingLinkInput = {
  id: string;
  status?: string | null;
};

export type JobLinkInput = {
  id: number;
  status?: string | null;
  winner_id?: string | null;
  /** Alias for `winner_id` when mirroring user-facing naming */
  cleaner_id?: string | null;
};

function hasAssigneeId(job: JobLinkInput): boolean {
  const w = job.winner_id;
  if (w != null && String(w).trim() !== "") return true;
  const c = job.cleaner_id;
  return c != null && String(c).trim() !== "";
}

/**
 * True when the job row represents assigned / active work that should use `/jobs/[id]`.
 * Matches: assignee id present, or status `in_progress` / `assigned`.
 */
export function isAssignedJobRoute(job: JobLinkInput | null | undefined): boolean {
  if (!job) return false;
  const st = String(job.status ?? "").toLowerCase();
  if (st === "in_progress" || st === "assigned") return true;
  return hasAssigneeId(job);
}

/**
 * Prefer listing URL until the job is in an assigned-work state; then use numeric job URL.
 */
export function hrefListingOrJob(
  listing: ListingLinkInput,
  job?: JobLinkInput | null
): string {
  if (!job) {
    return `/listings/${listing.id}`;
  }
  if (!isAssignedJobRoute(job)) {
    return `/listings/${listing.id}`;
  }
  return `/jobs/${job.id}`;
}

export function hrefListingOnly(listingId: string): string {
  return `/listings/${listingId}`;
}

export function hrefJobOnly(jobId: number): string {
  return `/jobs/${jobId}`;
}
