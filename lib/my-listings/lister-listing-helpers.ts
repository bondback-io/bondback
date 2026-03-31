import { formatDistanceToNowStrict } from "date-fns";
import type { ListingRow } from "@/lib/listings";
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
  if (st === "live" && endMs > nowMs) {
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
  const endMs = parseUtcTimestamp(String(listing.end_time ?? ""));
  const st = String(listing.status ?? "").toLowerCase();
  const auctionLive = st === "live" && endMs > nowMs;
  if (filter === "auctions") return auctionLive && !hasNonCancelledJob;
  return true;
}
