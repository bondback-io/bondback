import { formatDistanceToNowStrict } from "date-fns";
import type { ListingRow } from "@/lib/listings";
import { isListingLiveAt } from "@/lib/listings";
import { parseUtcTimestamp } from "@/lib/utils";

export type JobSnapshot = {
  jobId: string | number;
  winnerId: string | null;
  winnerName: string;
  status: string | null;
  cleanerConfirmedComplete?: boolean | null;
  cleanerConfirmedAt?: string | null;
  updatedAt?: string | null;
};

export type BadgeTone = "emerald" | "sky" | "amber" | "slate" | "rose" | "violet";

const DISPUTED = ["disputed", "in_review", "dispute_negotiating"] as const;

export function isDisputedJobStatus(status: string | null | undefined): boolean {
  return DISPUTED.includes(String(status ?? "") as (typeof DISPUTED)[number]);
}

/** Job states where the auction countdown should not show a future “Ends …” time. */
export function jobSuppressesListerAuctionCountdown(
  status: string | null | undefined
): boolean {
  const s = String(status ?? "");
  return (
    s === "accepted" ||
    s === "in_progress" ||
    s === "completed_pending_approval" ||
    s === "completed" ||
    s === "disputed" ||
    s === "in_review" ||
    s === "dispute_negotiating"
  );
}

/** True when the listing is in an open auction (live, before end) and no job has closed bidding. */
export function isListerAuctionLiveBidding(
  listing: ListingRow,
  job: JobSnapshot | null | undefined,
  nowMs: number
): boolean {
  const js = job?.status ?? null;
  if (js && jobSuppressesListerAuctionCountdown(js)) return false;
  return isListingLiveAt(listing, nowMs);
}

/** Listing has a real job row (winner / payment / work) — not the same as a live auction. */
export function isListerJobConverted(
  job: JobSnapshot | null | undefined
): boolean {
  const s = String(job?.status ?? "");
  if (!s || s === "cancelled") return false;
  return true;
}

/**
 * Listing row is a **closed** auction eligible for the relist pool by status/time alone
 * (ignores jobs — pair with a job check via {@link isListerNoBidsRelistListing}).
 *
 * - `expired` / `ended` from normal resolution.
 * - `live` but `end_time` is in the past and not ended early: stale row when cron/DB lag
 *   never flipped status (common cause of “shows in All, not in No bids, no Relist”).
 */
export function isListerRelistPoolListingStatus(
  listing: Pick<ListingRow, "status" | "end_time" | "cancelled_early_at">,
  nowMs: number = Date.now()
): boolean {
  const st = String(listing.status ?? "").toLowerCase();
  if (st === "expired" || st === "ended") return true;
  if (st !== "live") return false;
  if (listing.cancelled_early_at != null) return false;
  const raw = listing.end_time;
  if (raw == null || String(raw).trim() === "") return false;
  const endMs = parseUtcTimestamp(String(raw));
  if (!Number.isFinite(endMs)) return false;
  return endMs <= nowMs;
}

/**
 * My listings → "Listings (no bids)" relist pool: auction finished without a hired cleaner.
 * - `expired` = no bid rows when the auction closed.
 * - `ended` = had bids but none active / auto-assign failed (see auction-resolution).
 * - `live` with past `end_time` = same pool until status is normalized.
 * Excludes listings with a non-cancelled job (incl. completed).
 */
export function isListerNoBidsRelistListing(
  listing: Pick<ListingRow, "status" | "end_time" | "cancelled_early_at">,
  job: Pick<JobSnapshot, "status"> | null | undefined,
  nowMs: number = Date.now()
): boolean {
  const js = String(job?.status ?? "");
  if (js && js !== "cancelled") return false;
  return isListerRelistPoolListingStatus(listing, nowMs);
}

/** Active job pipeline (not yet fully completed) — use distinct card chrome vs live auctions. */
export function isListerJobPipelineActive(
  job: JobSnapshot | null | undefined
): boolean {
  const s = String(job?.status ?? "");
  if (!s || s === "cancelled" || s === "completed") return false;
  return true;
}

export function classifyListerBadge(
  listing: ListingRow,
  job: JobSnapshot | null | undefined,
  nowMs: number
): { key: string; label: string; tone: BadgeTone } {
  const js = job?.status ?? null;
  if (js && isDisputedJobStatus(js)) {
    return { key: "disputed", label: "Disputed", tone: "amber" };
  }
  if (js === "cancelled") {
    return { key: "cancelled", label: "Cancelled", tone: "slate" };
  }
  if (js === "completed") {
    return { key: "completed", label: "Completed", tone: "emerald" };
  }
  if (
    js === "accepted" ||
    js === "in_progress" ||
    js === "completed_pending_approval"
  ) {
    if (js === "accepted") {
      return { key: "job_accepted", label: "Awaiting approval", tone: "sky" };
    }
    if (js === "completed_pending_approval") {
      return { key: "job_pending_review", label: "Pending review", tone: "violet" };
    }
    return { key: "job_active", label: "In progress", tone: "sky" };
  }

  const st = String(listing.status ?? "").toLowerCase();
  const endMs = parseUtcTimestamp(String(listing.end_time ?? ""));
  if (isListingLiveAt(listing, nowMs)) {
    return { key: "live", label: "Active", tone: "emerald" };
  }
  if (st === "expired") {
    return { key: "expired", label: "Expired", tone: "slate" };
  }
  if (st === "live" && endMs <= nowMs) {
    return { key: "bidding_ended", label: "Bidding ended", tone: "amber" };
  }
  if (st === "ended") {
    return { key: "bidding_ended", label: "Bidding ended", tone: "amber" };
  }
  return { key: "other", label: st ? st : "Listing", tone: "slate" };
}

export function buildTimeLabel(listing: ListingRow, job: JobSnapshot | null | undefined, nowMs: number): string {
  const js = job?.status ?? null;
  if (js === "completed" && job?.cleanerConfirmedAt) {
    try {
      return `Completed ${formatDistanceToNowStrict(new Date(job.cleanerConfirmedAt), { addSuffix: true })}`;
    } catch {
      return "Completed";
    }
  }
  const endMs = parseUtcTimestamp(String(listing.end_time ?? ""));
  const st = String(listing.status ?? "").toLowerCase();
  if (js && jobSuppressesListerAuctionCountdown(js)) {
    if (Number.isFinite(endMs) && endMs <= nowMs) {
      try {
        return `Ended ${formatDistanceToNowStrict(new Date(endMs), { addSuffix: true })}`;
      } catch {
        return "Ended";
      }
    }
    const u = job?.updatedAt ? Date.parse(String(job.updatedAt)) : NaN;
    if (!Number.isNaN(u)) {
      try {
        return `Ended ${formatDistanceToNowStrict(new Date(u), { addSuffix: true })}`;
      } catch {
        return "Ended";
      }
    }
    return "Ended";
  }
  if (st === "live" && endMs > nowMs) {
    return `Ends ${formatDistanceToNowStrict(new Date(endMs), { addSuffix: true })}`;
  }
  if (endMs <= nowMs && (st === "live" || st === "ended" || st === "expired")) {
    try {
      return `Ended ${formatDistanceToNowStrict(new Date(endMs), { addSuffix: true })}`;
    } catch {
      return "Ended";
    }
  }
  if (listing.cancelled_early_at) {
    try {
      return `Ended ${formatDistanceToNowStrict(new Date(listing.cancelled_early_at), { addSuffix: true })}`;
    } catch {
      return "Ended early";
    }
  }
  return "";
}

export function listingMatchesCompletedTab(
  job: JobSnapshot | null | undefined
): boolean {
  return (job?.status ?? "") === "completed";
}

/**
 * Listing shows the violet “Paid job — auction closed…” card: job exists, escrow/work pipeline,
 * not completed, not disputed.
 */
export function isListerPaidJobListing(
  job: JobSnapshot | null | undefined
): boolean {
  const s = String(job?.status ?? "");
  if (!s || s === "cancelled" || s === "completed") return false;
  if (isDisputedJobStatus(s)) return false;
  return (
    s === "accepted" ||
    s === "in_progress" ||
    s === "completed_pending_approval"
  );
}

export type ListFilter = "all" | "auctions" | "jobs";

export function passesListFilter(
  filter: ListFilter,
  listing: ListingRow,
  job: JobSnapshot | null | undefined,
  nowMs: number
): boolean {
  if (filter === "all") return true;
  const js = job?.status ?? null;
  const hasNonCancelledJob = Boolean(js && js !== "cancelled");
  if (filter === "jobs") return hasNonCancelledJob;
  const auctionLive = isListingLiveAt(listing, nowMs);
  if (filter === "auctions") return auctionLive && !hasNonCancelledJob;
  return true;
}
