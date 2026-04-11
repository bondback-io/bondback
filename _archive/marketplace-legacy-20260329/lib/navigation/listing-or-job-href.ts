/**
 * Routing model:
 * - Live/bidding work lives in `listings` → `/listings/[uuid]`
 * - Assigned / in-progress jobs live in `jobs` → `/jobs/[numericId]`
 *
 * `jobs` uses `winner_id` for the assigned cleaner. `cleaner_id` is accepted as an alias
 * (e.g. merged shapes) to match call-site naming.
 */

export type ListingLinkInput = {
  id: string;
  status?: string | null;
};

export type JobLinkInput = {
  id: number;
  status?: string | null;
  winner_id?: string | null;
  cleaner_id?: string | null;
};

/** Card / row shape: either a listing row, a job row, or a merged object with `listing_id` + job fields. */
export type MarketplaceDetailItem = {
  id: string | number;
  listing_id?: string | null;
  status?: string | null;
  winner_id?: string | null;
  cleaner_id?: string | null;
};

/**
 * True when the row should open `/jobs/[numericId]` (assigned / job lifecycle),
 * not the live auction at `/listings/[uuid]`.
 *
 * Base rule (listings vs jobs):
 * ```ts
 * !!item.cleaner_id
 *   || item.status === 'in_progress'
 *   || item.status === 'assigned'
 *   || item.status === 'completed'
 * ```
 * (status compared case-insensitively). Extended for DB rows: non-empty `winner_id`
 * (jobs table assignee), plus `accepted`, disputes, `cancelled`, etc.
 */
export function isAssignedJob(item: MarketplaceDetailItem | null | undefined): boolean {
  if (!item) return false;
  if (item.cleaner_id != null && String(item.cleaner_id).trim() !== "") return true;
  const st = String(item.status ?? "").toLowerCase();
  if (st === "in_progress" || st === "assigned" || st === "completed") return true;
  if (item.winner_id != null && String(item.winner_id).trim() !== "") return true;
  if (
    st === "accepted" ||
    st === "completed_pending_approval" ||
    st === "disputed" ||
    st === "in_review" ||
    st === "dispute_negotiating" ||
    st === "cancelled"
  ) {
    return true;
  }
  return false;
}

/** @deprecated Use {@link isAssignedJob} */
export function isJobAssigned(item: MarketplaceDetailItem | null | undefined): boolean {
  return isAssignedJob(item);
}

/**
 * Single conditional for cards — mirrors:
 * `isAssignedJob ? `/jobs/${item.id}` : `/listings/${item.listing_id || item.id}``
 * with safe handling when `id` is a numeric job PK (always use `listing_id` for `/listings/`).
 */
export function detailUrlForCardItem(item: MarketplaceDetailItem): string {
  if (isAssignedJob(item)) {
    return `/jobs/${item.id}`;
  }
  const listingKey =
    item.listing_id ??
    (typeof item.id === "string" ? item.id : null);
  if (!listingKey) {
    return "/jobs";
  }
  return `/listings/${listingKey}`;
}

/**
 * Prefer listing URL until the job is assigned; then use numeric job URL.
 */
export function hrefListingOrJob(
  listing: ListingLinkInput,
  job?: JobLinkInput | null
): string {
  if (!job) {
    return `/listings/${listing.id}`;
  }
  return detailUrlForCardItem({
    id: job.id,
    listing_id: listing.id,
    status: job.status,
    winner_id: job.winner_id,
    cleaner_id: job.cleaner_id,
  });
}

export function hrefListingOnly(listingId: string): string {
  return `/listings/${listingId}`;
}

export function hrefJobOnly(jobId: number): string {
  return `/jobs/${jobId}`;
}

/** @deprecated Use {@link isAssignedJob} */
export const isAssignedJobRoute = (job: JobLinkInput | null | undefined) =>
  isAssignedJob(job ?? undefined);
