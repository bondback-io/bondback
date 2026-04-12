/**
 * Routing model:
 * - Live / open auctions: rows live in `listings` → `/listings/[listingId]`
 * - After a cleaner is assigned (winner_id / etc.): `jobs` row exists → `/jobs/[numericJobPk]`
 *
 * Never treat a listing primary key as a job PK: legacy numeric listing ids must not become
 * `/jobs/[sameNumber]` when no job row exists. Job PK is only inferred when the item shape
 * looks like a job row (`listing_id` present and different from `id`).
 *
 * `jobs` uses `winner_id` for the assigned cleaner. `cleaner_id` is accepted as an alias.
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
  job_id?: number | string | null;
  listing_id?: string | null;
  status?: string | null;
  winner_id?: string | null;
  cleaner_id?: string | null;
};

/**
 * True when the UI should use the job detail route (`/jobs/[numericId]`).
 * Requires a real assignee (or dispute flow on the job row). Status-only checks like
 * `in_progress` without winner_id caused `/jobs/[listingPk]` when listing ids were numeric.
 */
export function isJobAssigned(item: MarketplaceDetailItem | null | undefined): boolean {
  if (!item) return false;
  if (item.cleaner_id != null && String(item.cleaner_id).trim() !== "") return true;
  if (item.winner_id != null && String(item.winner_id).trim() !== "") return true;
  const st = String(item.status ?? "").toLowerCase();
  return (
    st === "disputed" ||
    st === "in_review" ||
    st === "dispute_negotiating"
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
  if (typeof item.job_id === "string" && /^\d+$/.test(item.job_id.trim())) {
    const n = parseInt(item.job_id, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof item.id === "number" && Number.isFinite(item.id)) {
    return item.id;
  }
  const idStr = typeof item.id === "string" ? item.id.trim() : "";
  const listingIdStr =
    item.listing_id != null ? String(item.listing_id).trim() : "";
  // Job rows: numeric PK `id` + separate `listing_id` (listing UUID). Do not treat a bare
  // numeric listing `id` as a job PK (detailUrlForCardItem({ id: listing.id }) only).
  if (
    listingIdStr !== "" &&
    listingIdStr !== idStr &&
    /^\d+$/.test(idStr)
  ) {
    const n = parseInt(idStr, 10);
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
 * Listers/cleaners browse live auctions on `/listings/[uuid]`. Only after a cleaner is assigned
 * (winner_id / dispute on the job row) is `/jobs/[numericPk]` the primary surface.
 *
 * Rule: **default to `/listings/{listing.id}`** unless the linked job row is “assigned” per
 * {@link isJobAssigned}. This avoids `/jobs/[n]` when no job exists yet or the row has no winner
 * (still in listings / bidding phase), even if `end_time` or `status` are momentarily wrong.
 */
export function hrefListingOrJob(
  listing: ListingLinkInput,
  job?: JobLinkInput | null
): string {
  if (
    job &&
    isJobAssigned({
      id: job.id,
      job_id: job.id,
      listing_id: listing.id,
      status: job.status,
      winner_id: job.winner_id,
      cleaner_id: job.cleaner_id,
    })
  ) {
    return detailUrlForCardItem({
      id: job.id,
      job_id: job.id,
      listing_id: listing.id,
      status: job.status,
      winner_id: job.winner_id,
      cleaner_id: job.cleaner_id,
    });
  }
  return `/listings/${listing.id}`;
}

export function hrefListingOnly(listingId: string): string {
  return `/listings/${listingId}`;
}

export function hrefJobOnly(jobId: number): string {
  return `/jobs/${jobId}`;
}
