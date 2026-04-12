/**
 * Routing model:
 * - Live / open auctions: rows live in `listings` → `/listings/[uuid]`
 * - Assigned work: rows in `jobs` → `/jobs/[numericId]` only when there is a real job PK
 *
 * `jobs` uses `winner_id` for the assigned cleaner. `cleaner_id` is accepted as an alias
 * (e.g. bids or merged shapes).
 */

import { parseUtcTimestamp } from "@/lib/utils";

export type ListingLinkInput = {
  id: string;
  status?: string | null;
  /** When set, open auctions keep `/listings/...` even if a placeholder job row exists. */
  end_time?: string | null;
};

export type JobLinkInput = {
  id: number;
  status?: string | null;
  winner_id?: string | null;
  cleaner_id?: string | null;
};

/** Card / row shape: listing row, job row, or merged object with `listing_id` + job fields. */
export type MarketplaceDetailItem = {
  id: string | number;
  /** When `id` is a listing UUID but job id is known separately */
  job_id?: number | null;
  listing_id?: string | null;
  status?: string | null;
  winner_id?: string | null;
  cleaner_id?: string | null;
};

/**
 * True when the UI should use the job detail route (`/jobs/[numericId]`).
 * Matches product rule: assignee fields or post-award job statuses.
 */
export function isJobAssigned(item: MarketplaceDetailItem | null | undefined): boolean {
  if (!item) return false;
  if (item.cleaner_id != null && String(item.cleaner_id).trim() !== "") return true;
  if (item.winner_id != null && String(item.winner_id).trim() !== "") return true;
  const st = String(item.status ?? "").toLowerCase();
  return (
    st === "in_progress" ||
    st === "assigned" ||
    st === "completed"
  );
}

/** @deprecated Prefer {@link isJobAssigned} */
export const isAssignedJobRoute = (job: JobLinkInput | null | undefined) =>
  isJobAssigned(job ?? undefined);

/** Alias for {@link isJobAssigned} */
export const isAssignedJob = isJobAssigned;

/** Listing is still an open auction — always use `/listings/[uuid]`, not `/jobs/[id]`. */
export function isListingLiveAuction(
  listing: Pick<ListingLinkInput, "status" | "end_time">
): boolean {
  const lst = String(listing.status ?? "").toLowerCase();
  if (lst !== "live") return false;
  const raw = listing.end_time;
  if (raw == null || String(raw).trim() === "") return true;
  const endMs = parseUtcTimestamp(String(raw));
  if (Number.isNaN(endMs)) return true;
  return endMs > Date.now();
}

function resolveNumericJobId(item: MarketplaceDetailItem): number | null {
  if (typeof item.job_id === "number" && Number.isFinite(item.job_id)) {
    return item.job_id;
  }
  if (typeof item.id === "number" && Number.isFinite(item.id)) {
    return item.id;
  }
  if (typeof item.id === "string" && /^\d+$/.test(item.id.trim())) {
    const n = parseInt(item.id, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Prefer `/listings/...` unless we have a numeric job id and the row is “assigned”.
 * Never emits `/jobs/[uuid]` (that always 404s).
 */
export function detailUrlForCardItem(item: MarketplaceDetailItem): string {
  if (isJobAssigned(item)) {
    const jobPk = resolveNumericJobId(item);
    if (jobPk != null) {
      return `/jobs/${jobPk}`;
    }
  }
  const listingKey =
    item.listing_id ?? (typeof item.id === "string" ? item.id : null);
  if (!listingKey) {
    return "/jobs";
  }
  return `/listings/${listingKey}`;
}

/**
 * Prefer listing URL while the auction is live; then job vs listing from assignee/status.
 */
export function hrefListingOrJob(
  listing: ListingLinkInput,
  job?: JobLinkInput | null
): string {
  if (isListingLiveAuction(listing)) {
    return `/listings/${listing.id}`;
  }
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
