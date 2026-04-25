"use client";

import { useState } from "react";
import { format } from "date-fns";
import { formatCents } from "@/lib/listings";
import type { BidRow } from "@/lib/listings";
import type { BidBidderProfileSummary } from "@/lib/bids/bidder-types";
import { bidderDisplayNameForBid } from "@/lib/bids/bidder-display";
import { getBidderProfileForListingBid } from "@/lib/actions/bidder-profile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { BidderProfilePreviewDialog } from "@/components/features/bidder-profile-preview-dialog";
import { CleanerExperienceBadge } from "@/components/shared/cleaner-experience-badge";
import { useToast } from "@/components/ui/use-toast";

export type { BidBidderProfileSummary };

export type BidWithBidder = BidRow & {
  bidder_email?: string | null;
  bidder_profile?: BidBidderProfileSummary | null;
};

/** When the auction is no longer live, `active` bids show this in the Status column. */
export type ClosedAuctionBidStatus = "lister_cancelled" | "auction_ended";

function bidderListingLineStats(bid: BidWithBidder) {
  const p = bid.bidder_profile;
  const ratingRaw = p?.cleaner_avg_rating;
  const rating =
    ratingRaw != null && !Number.isNaN(Number(ratingRaw))
      ? Number(ratingRaw)
      : 0;
  const jobsRaw = p?.completed_jobs_count;
  const jobs =
    p == null
      ? 0
      : jobsRaw != null && !Number.isNaN(Number(jobsRaw))
        ? Math.max(0, Math.round(Number(jobsRaw)))
        : 0;
  return { rating, jobs };
}

function BidderCellContents({
  bid,
  hideExperienceBadge = false,
  nameWarningBadge,
}: {
  bid: BidWithBidder;
  /** Mobile cards show the badge in the &quot;Bidder&quot; header — omit inline badge. */
  hideExperienceBadge?: boolean;
  /** Shown after the name when the job was cancelled and refunded (e.g. lister cancel). */
  nameWarningBadge?: string | null;
}) {
  const { rating, jobs } = bidderListingLineStats(bid);
  const name = bidderDisplayNameForBid(bid);

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-left">
      <span
        className="inline-flex shrink-0 items-center gap-0.5"
        title={`Average rating ${rating.toFixed(1)}`}
      >
        <Star
          className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
          aria-hidden
        />
        <span className="tabular-nums font-semibold text-foreground dark:text-gray-100">
          {rating.toFixed(1)}
        </span>
      </span>
      <span
        className="shrink-0 tabular-nums text-muted-foreground dark:text-gray-400"
        title="Completed jobs on Bond Back"
      >
        ({jobs})
      </span>
      <span className="min-w-0 break-words font-medium text-primary dark:text-blue-300">{name}</span>
      {nameWarningBadge ? (
        <Badge
          variant="outline"
          className="max-w-full shrink-0 border-amber-400/90 bg-amber-50/90 text-[10px] font-medium leading-tight text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
        >
          {nameWarningBadge}
        </Badge>
      ) : null}
      {!hideExperienceBadge ? <CleanerExperienceBadge jobs={jobs} /> : null}
    </span>
  );
}

export type BidHistoryTableProps = {
  bids: BidWithBidder[];
  /** Listing UUID — required to load bidder profile in the preview dialog. */
  listingId: string;
  /** When set, show Accept bid button for lister (listing owner, no job yet). */
  onAcceptBid?: (bid: BidWithBidder) => Promise<void>;
  /** True if any bid is still in legacy `pending_confirmation` (blocks a second accept until cleared). */
  hasPendingEarlyAcceptance?: boolean;
  /** Cleaner + live listing: withdraw most recent active bid by this user (calls server action). */
  showRevertLastBid?: boolean;
  onRevertLastBid?: () => Promise<void>;
  /** Larger button (e.g. job detail on mobile). */
  largeTouch?: boolean;
  /**
   * When the listing auction has ended, explains why `active` bids are no longer actionable
   * (lister cancelled vs natural end).
   */
  closedAuctionBidStatus?: ClosedAuctionBidStatus | null;
  /** When the job was secured via Buy Now — shows a clear record even if no bid rows exist. */
  buyNowJobOutcome?: { amountCents: number } | null;
  /**
   * Agreed / secured job price. When the winning `accepted` bid `amount_cents` differs, Amount shows
   * this as the line price and the bid as "on file" (e.g. Buy Now at $800 with a $900 high bid on record).
   */
  jobSecuredAmountCents?: number | null;
  /** Job row: secured via buy now. */
  securedViaBuyNow?: boolean;
  /**
   * When set, shown on the `accepted` winning bid (and after name) for cancelled+refund jobs
   * (e.g. lister non-responsive cancel).
   */
  winnerBidStatusWarning?: string | null;
};

function displayAmountForBid(
  bid: BidWithBidder,
  jobSecuredAmountCents: number | null | undefined,
  securedViaBuyNow: boolean | undefined
): { primary: number; onFile: number | null } {
  const primary =
    jobSecuredAmountCents != null &&
    jobSecuredAmountCents > 0 &&
    bid.status === "accepted" &&
    (securedViaBuyNow || jobSecuredAmountCents !== bid.amount_cents)
      ? jobSecuredAmountCents
      : bid.amount_cents;
  const onFile =
    primary !== bid.amount_cents && bid.status === "accepted" ? bid.amount_cents : null;
  return { primary, onFile };
}

export function BidHistoryTable({
  bids,
  listingId,
  onAcceptBid,
  hasPendingEarlyAcceptance = false,
  showRevertLastBid = false,
  onRevertLastBid,
  largeTouch = false,
  closedAuctionBidStatus = null,
  buyNowJobOutcome = null,
  jobSecuredAmountCents = null,
  securedViaBuyNow = false,
  winnerBidStatusWarning = null,
}: BidHistoryTableProps) {
  const { toast } = useToast();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [confirmBid, setConfirmBid] = useState<BidWithBidder | null>(null);
  const [reverting, setReverting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<BidBidderProfileSummary | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openBidderPreview = async (bid: BidWithBidder) => {
    setPreviewOpen(true);
    setPreviewProfile(null);
    setPreviewLoading(true);
    const res = await getBidderProfileForListingBid(listingId, bid.cleaner_id);
    setPreviewLoading(false);
    if (res.ok) {
      setPreviewProfile(res.profile);
    } else {
      toast({
        variant: "destructive",
        title: "Could not load profile",
        description: res.error,
      });
      setPreviewOpen(false);
    }
  };
  const sorted = [...bids].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const buyNowBanner =
    buyNowJobOutcome != null ? (
      <div className="rounded-lg border border-violet-300/90 bg-violet-50/90 px-3 py-2.5 text-sm dark:border-violet-700/70 dark:bg-violet-950/45">
        <p className="font-semibold text-violet-950 dark:text-violet-100">Buy Now purchase</p>
        <p className="mt-1 leading-snug text-violet-900/95 dark:text-violet-100/90">
          This listing was purchased using <span className="font-semibold">Buy Now</span> at{" "}
          <span className="font-semibold tabular-nums">
            {formatCents(buyNowJobOutcome.amountCents)}
          </span>
          . No auction bid was required to assign this job.
        </p>
      </div>
    ) : null;

  if (sorted.length === 0) {
    return (
      <div className="space-y-3">
        {buyNowBanner}
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          {buyNowJobOutcome != null
            ? "No separate auction bids were recorded on this listing."
            : "No bids yet."}
        </p>
      </div>
    );
  }

  const openConfirm = (bid: BidWithBidder) => {
    setConfirmBid(bid);
  };

  const handleConfirmAccept = () => {
    if (!confirmBid || !onAcceptBid) return;
    const bid = confirmBid;
    void (async () => {
      setAcceptingId(bid.id);
      try {
        await onAcceptBid(bid);
      } finally {
        setAcceptingId(null);
        setConfirmBid(null);
      }
    })();
  };

  const handleRevertLastBidClick = async () => {
    if (!onRevertLastBid) return;
    if (
      !window.confirm(
        "Cancel your last bid on this listing? You can bid again afterwards."
      )
    ) {
      return;
    }
    setReverting(true);
    try {
      await onRevertLastBid();
    } finally {
      setReverting(false);
    }
  };

  const showEarlyButton = (bid: BidWithBidder) => {
    if (!onAcceptBid) return false;
    if (bid.status === "pending_confirmation") return false;
    if (bid.status === "declined_early") return false;
    if (bid.status === "accepted") return false;
    if (hasPendingEarlyAcceptance) return false;
    return bid.status === "active";
  };

  const statusLabel = (bid: BidWithBidder) => {
    if (bid.status === "accepted") {
      return (
        <div className="flex flex-col items-start gap-1.5 sm:items-stretch">
          <Badge className="border-0 bg-emerald-600 font-normal text-white hover:bg-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-700">
            Bidder won
          </Badge>
          {winnerBidStatusWarning ? (
            <Badge
              variant="outline"
              className="max-w-full whitespace-normal border-amber-500/80 bg-amber-50/90 text-[10px] font-medium leading-tight text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
            >
              {winnerBidStatusWarning}
            </Badge>
          ) : null}
        </div>
      );
    }
    if (bid.status === "pending_confirmation") {
      return (
        <Badge variant="secondary" className="font-normal">
          Awaiting cleaner confirmation
        </Badge>
      );
    }
    if (bid.status === "declined_early") {
      return (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          Declined early offer
        </Badge>
      );
    }
    if (bid.status === "active" && closedAuctionBidStatus) {
      if (closedAuctionBidStatus === "lister_cancelled") {
        return (
          <Badge variant="secondary" className="font-normal">
            Bid cancelled by lister
          </Badge>
        );
      }
      return (
        <Badge variant="secondary" className="font-normal">
          Auction ended
        </Badge>
      );
    }
    return null;
  };

  return (
    <>
      {buyNowBanner}
      {/* Mobile: card layout so Accept bid is full-width and readable */}
      <ul className="space-y-3 md:hidden">
        {sorted.map((bid) => {
          const statusEl = statusLabel(bid);
          const { jobs: headerJobs } = bidderListingLineStats(bid);
          const amountParts = displayAmountForBid(
            bid,
            jobSecuredAmountCents,
            securedViaBuyNow
          );
          const nameWarn = bid.status === "accepted" ? winnerBidStatusWarning : null;
          return (
            <li
              key={bid.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/70"
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                    Bidder
                  </p>
                  <CleanerExperienceBadge jobs={headerJobs} />
                </div>
                <button
                  type="button"
                  onClick={() => void openBidderPreview(bid)}
                  className="break-words text-left text-sm underline-offset-4 hover:underline"
                >
                  <BidderCellContents
                    bid={bid}
                    hideExperienceBadge
                    nameWarningBadge={nameWarn}
                  />
                </button>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3 dark:border-gray-700">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                    Amount
                  </p>
                  <p className="text-lg font-bold tabular-nums text-foreground dark:text-gray-50">
                    {formatCents(amountParts.primary)}
                  </p>
                  {amountParts.onFile != null ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-gray-500">
                      Bid on file: {formatCents(amountParts.onFile)}
                      {securedViaBuyNow ? " · job secured with Buy Now at this job price" : null}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                    Time
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground dark:text-gray-400">
                    {format(new Date(bid.created_at), "d MMM yyyy, HH:mm")}
                  </p>
                </div>
              </div>
              {statusEl ? <div className="mt-2">{statusEl}</div> : null}
              {onAcceptBid && hasPendingEarlyAcceptance && bid.status !== "pending_confirmation" && (
                <p className="mt-2 text-xs text-muted-foreground dark:text-gray-500">
                  Another bid is awaiting cleaner confirmation. You can accept a different bid after that
                  request is confirmed, declined, or expires.
                </p>
              )}
              {showEarlyButton(bid) && (
                <Button
                  type="button"
                  size="lg"
                  variant="default"
                  className="mt-4 h-12 w-full text-base font-semibold"
                  disabled={!!acceptingId}
                  onClick={() => openConfirm(bid)}
                >
                  {acceptingId === bid.id ? "Working…" : "Accept bid"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-md border border-border dark:border-gray-700 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 dark:border-gray-700 dark:bg-gray-800/90">
              <th className="px-3 py-2 text-left font-medium text-foreground dark:text-gray-200">
                Bidder
              </th>
              <th className="px-3 py-2 text-right font-medium text-foreground dark:text-gray-200">
                Amount
              </th>
              <th className="px-3 py-2 text-right font-medium text-foreground dark:text-gray-200">
                Time
              </th>
              <th className="min-w-[8rem] px-3 py-2 text-left font-medium text-foreground dark:text-gray-200">
                Status
              </th>
              {onAcceptBid && (
                <th className="min-w-[7.5rem] px-3 py-2 text-right font-medium text-foreground dark:text-gray-200">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((bid) => {
              const amountParts = displayAmountForBid(
                bid,
                jobSecuredAmountCents,
                securedViaBuyNow
              );
              const nameWarn = bid.status === "accepted" ? winnerBidStatusWarning : null;
              return (
              <tr
                key={bid.id}
                className="border-b border-border last:border-0 dark:border-gray-700/80"
              >
                <td className="px-3 py-2 text-foreground dark:text-gray-200">
                  <button
                    type="button"
                    onClick={() => void openBidderPreview(bid)}
                    className="text-left underline-offset-4 hover:underline"
                  >
                    <BidderCellContents bid={bid} nameWarningBadge={nameWarn} />
                  </button>
                </td>
                <td className="px-3 py-2 text-right text-foreground dark:text-gray-100">
                  <div className="font-medium tabular-nums">
                    {formatCents(amountParts.primary)}
                  </div>
                  {amountParts.onFile != null ? (
                    <div className="mt-0.5 max-w-[12rem] text-left text-[10px] leading-snug text-muted-foreground dark:text-gray-500 sm:text-right sm:ml-auto sm:max-w-none">
                      Bid on file {formatCents(amountParts.onFile)}
                      {securedViaBuyNow ? " · Buy Now at job price" : ""}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground dark:text-gray-400">
                  {format(new Date(bid.created_at), "d MMM yyyy, HH:mm")}
                </td>
                <td className="px-3 py-2 align-middle text-left">
                  {statusLabel(bid)}
                </td>
                {onAcceptBid && (
                  <td className="px-3 py-2 text-right align-middle">
                    <div className="flex flex-col items-end gap-1">
                      {showEarlyButton(bid) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="text-xs font-semibold"
                          disabled={!!acceptingId}
                          onClick={() => openConfirm(bid)}
                        >
                          {acceptingId === bid.id ? "Working…" : "Accept bid"}
                        </Button>
                      ) : hasPendingEarlyAcceptance && bid.status !== "pending_confirmation" ? (
                        <span className="max-w-[12rem] text-[11px] text-muted-foreground dark:text-gray-500">
                          Early accept pending on another bid
                        </span>
                      ) : null}
                    </div>
                  </td>
                )}
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      {showRevertLastBid && onRevertLastBid ? (
        <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size={largeTouch ? "default" : "sm"}
            className={cn(
              "w-full border-amber-300 font-semibold text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-950/40 sm:w-auto",
              largeTouch && "min-h-12 text-base"
            )}
            disabled={reverting}
            onClick={() => void handleRevertLastBidClick()}
          >
            {reverting ? "Cancelling…" : "Cancel last bid"}
          </Button>
        </div>
      ) : null}

      <BidderProfilePreviewDialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            setPreviewProfile(null);
            setPreviewLoading(false);
          }
        }}
        profile={previewProfile}
        loading={previewLoading}
      />

      <Dialog
        open={confirmBid != null}
        onOpenChange={(open) => {
          if (!open && acceptingId) return;
          if (!open) setConfirmBid(null);
        }}
      >
        <DialogContent className="max-w-md dark:border-gray-800 dark:bg-gray-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Accept this bid?</DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed dark:text-gray-400">
              This creates the job at{" "}
              <span className="font-semibold tabular-nums text-foreground dark:text-gray-100">
                {confirmBid != null ? formatCents(confirmBid.amount_cents) : "—"}
              </span>
              . The cleaner is notified by email and in-app. You can then pay &amp; start the job when
              you&apos;re ready.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 dark:border-gray-600 dark:hover:bg-gray-800"
              disabled={!!acceptingId}
              onClick={() => setConfirmBid(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-12 font-semibold"
              disabled={!!acceptingId}
              onClick={handleConfirmAccept}
            >
              {acceptingId ? "Working…" : "Accept bid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
