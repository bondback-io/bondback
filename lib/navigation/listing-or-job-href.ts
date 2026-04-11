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
 * True when the row should open the job detail route (assigned work).
 * Uses assignee fields (`winner_id` / `cleaner_id`) plus job lifecycle statuses such as
 * `accepted`, `in_progress`, `completed`, dispute phases, etc.
 */
export function isJobAssigned(item: MarketplaceDetailItem | null | undefined): boolean {
  if (!item) return false;
  const assignee = item.cleaner_id ?? item.winner_id;
  if (assignee != null && String(assignee).trim() !== "") return true;
  const st = String(item.status ?? "").toLowerCase();
  return (
    st === "accepted" ||
    st === "in_progress" ||
    st === "assigned" ||
    st === "completed" ||
    st === "completed_pending_approval" ||
    st === "disputed" ||
    st === "in_review" ||
    st === "dispute_negotiating"
  );
}

/**
 * Single conditional for cards: job route when assigned, else listing URL.
 * For listing-only rows, `id` is the listing UUID and `listing_id` is usually omitted.
 */
export function detailUrlForCardItem(item: MarketplaceDetailItem): string {
  if (isJobAssigned(item)) {
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

/** @deprecated Use {@link isJobAssigned} */
export const isAssignedJobRoute = (job: JobLinkInput | null | undefined) =>
  isJobAssigned(job ?? undefined);
