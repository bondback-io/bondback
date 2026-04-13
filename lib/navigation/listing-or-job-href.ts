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
 *
 * **Do not** implement card URLs as `isAssignedJob ? /jobs/${item.id} : /listings/${item.id}`:
 * listing rows have `id` only (no `listing_id`); job rows include `listing_id` + job PK in `id`.
 * Use {@link detailUrlForCardItem} or {@link hrefListingOrJob} everywhere.
 */

import { parseUtcTimestamp } from "@/lib/utils";

export type ListingLinkInput = {
  id: string;
  status?: string | null;
  /** When set, open auctions keep `/listings/...` even if a placeholder job row exists. */
  end_time?: string | null;
  cancelled_early_at?: string | null;
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

/** Job-shaped rows include `listing_id` (FK to `listings`). Pure listing rows do not set `listing_id`. */
function looksLikeJobsTableRow(item: MarketplaceDetailItem): boolean {
  const listingIdStr =
    item.listing_id != null ? String(item.listing_id).trim() : "";
  if (!listingIdStr) return false;
  if (typeof item.id === "number" && Number.isFinite(item.id)) {
    return true;
  }
  const idStr = typeof item.id === "string" ? item.id.trim() : "";
  return /^\d+$/.test(idStr);
}

/**
 * Status values on a **job row** (see {@link looksLikeJobsTableRow}) that mean “use `/jobs/[id]`”
 * when we already resolved a numeric job PK. Omits early placeholders like `pending` before assign.
 */
const JOB_ROW_ROUTE_STATUSES = new Set([
  "accepted",
  "in_progress",
  "completed_pending_approval",
  "completed",
  "cancelled",
]);

function resolveNumericJobId(item: MarketplaceDetailItem): number | null {
  if (typeof item.job_id === "number" && Number.isFinite(item.job_id)) {
    return item.job_id;
  }
  if (typeof item.job_id === "string" && /^\d+$/.test(item.job_id.trim())) {
    const n = parseInt(item.job_id, 10);
    return Number.isFinite(n) ? n : null;
  }
  const listingIdStr =
    item.listing_id != null ? String(item.listing_id).trim() : "";
  if (!listingIdStr) {
    return null;
  }
  if (typeof item.id === "number" && Number.isFinite(item.id)) {
    return item.id;
  }
  const idStr = typeof item.id === "string" ? item.id.trim() : "";
  if (/^\d+$/.test(idStr)) {
    const n = parseInt(idStr, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * True when the UI should use the job detail route (`/jobs/[numericId]`).
 * Uses assignee fields first; for rows that clearly come from `jobs`, also respects job status.
 */
export function isJobAssigned(item: MarketplaceDetailItem | null | undefined): boolean {
  if (!item) return false;
  if (item.cleaner_id != null && String(item.cleaner_id).trim() !== "") return true;
  if (item.winner_id != null && String(item.winner_id).trim() !== "") return true;
  const st = String(item.status ?? "").toLowerCase();
  if (
    st === "disputed" ||
    st === "in_review" ||
    st === "dispute_negotiating"
  ) {
    return true;
  }
  if (looksLikeJobsTableRow(item) && JOB_ROW_ROUTE_STATUSES.has(st)) {
    return resolveNumericJobId(item) != null;
  }
  return false;
}

/** @deprecated Prefer {@link isJobAssigned} */
export const isAssignedJobRoute = (job: JobLinkInput | null | undefined) =>
  isJobAssigned(job ?? undefined);

/** Alias for {@link isJobAssigned} */
export const isAssignedJob = isJobAssigned;

/** Listing is still an open auction — always use `/listings/[uuid]`, not `/jobs/[id]`. */
export function isListingLiveAuction(listing: ListingLinkInput): boolean {
  if (listing.cancelled_early_at != null) return false;
  const lst = String(listing.status ?? "").toLowerCase();
  if (lst !== "live") return false;
  const raw = listing.end_time;
  if (raw == null || String(raw).trim() === "") return false;
  const endMs = parseUtcTimestamp(String(raw));
  if (!Number.isFinite(endMs)) return false;
  return endMs > Date.now();
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
    item.listing_id != null && String(item.listing_id).trim() !== ""
      ? String(item.listing_id).trim()
      : typeof item.id === "string"
        ? item.id.trim()
        : typeof item.id === "number" && Number.isFinite(item.id)
          ? String(item.id)
          : null;
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
