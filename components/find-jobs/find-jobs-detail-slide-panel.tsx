"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useFindJobsMap } from "@/components/find-jobs/find-jobs-map-context";
import { ListingPublicCommentsDock } from "@/components/features/listing-public-comments-dock";
import { ListingAuctionDetail } from "@/components/features/listing-auction-detail";
import type { BidWithBidder } from "@/components/features/bid-history-table";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchListingCommentsPublic } from "@/lib/actions/listing-comments";
import type { ListingCommentPublic } from "@/lib/actions/listing-comments";
import { fetchListingBidsForFindJobsPanel } from "@/lib/actions/find-jobs-detail";
import { shouldShowPublicListingComments } from "@/lib/listing-public-comments-visibility";
import type { ListingRow } from "@/lib/listings";

function useLgUp() {
  const [lgUp, setLgUp] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setLgUp(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return lgUp;
}

export type FindJobsDetailPanelBodyProps = {
  listing: ListingRow;
  onBack: () => void;
  /** e.g. “Back to map” on desktop, “Close” on mobile sheet */
  backLabel: string;
};

/**
 * Full listing-style detail for Find Jobs (inline panel + mobile sheet): auction UI, Q&amp;A, optional full-page link.
 */
export function FindJobsDetailPanelBody({
  listing,
  onBack,
  backLabel,
}: FindJobsDetailPanelBodyProps) {
  const { viewerIsCleaner, viewerUserId, viewerActiveRole, patchDetailListingRow } =
    useFindJobsMap();

  const [bids, setBids] = React.useState<BidWithBidder[] | null>(null);
  const [bidsLoading, setBidsLoading] = React.useState(true);

  const [comments, setComments] = React.useState<ListingCommentPublic[] | null>(null);
  const [commentsLoading, setCommentsLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setBidsLoading(true);
    setBids(null);
    void fetchListingBidsForFindJobsPanel(String(listing.id)).then((rows) => {
      if (!cancelled) {
        setBids(rows);
        setBidsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [listing.id]);

  React.useEffect(() => {
    if (!listing) {
      setComments(null);
      return;
    }
    if (!shouldShowPublicListingComments(listing, false)) {
      setComments([]);
      setCommentsLoading(false);
      return;
    }
    let cancelled = false;
    setCommentsLoading(true);
    void fetchListingCommentsPublic(String(listing.id), String(listing.lister_id)).then(
      (rows) => {
        if (!cancelled) {
          setComments(rows);
          setCommentsLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [listing]);

  const showQa =
    listing &&
    shouldShowPublicListingComments(listing, false) &&
    comments !== null;

  const uid = viewerUserId;
  const listerId = String(listing.lister_id);
  const isOwner = uid != null && String(uid) === listerId;
  const ownerListerSession = Boolean(isOwner && viewerActiveRole === "lister");
  const listerActiveViewingOthersListing = Boolean(
    uid && viewerActiveRole === "lister" && String(uid) !== listerId
  );

  const isListerSessionActive = viewerActiveRole === "lister";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {bidsLoading || bids === null ? (
          <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading job details…
          </div>
        ) : (
          <div className="px-3 pb-8 pt-4 sm:px-5">
            <ListingAuctionDetail
              listing={listing}
              initialBids={bids}
              isCleaner={viewerIsCleaner}
              isListerOwner={isOwner}
              isListerSessionActive={isListerSessionActive}
              hasActiveJob={false}
              numericJobId={null}
              currentUserId={viewerUserId}
              embedInFindJobs
              embedOnBackToMap={onBack}
              embedBackLinkLabel={backLabel}
              onBidPlaced={(cents) =>
                patchDetailListingRow(String(listing.id), {
                  current_lowest_bid_cents: cents,
                })
              }
            />

            <div className="mx-auto mt-8 w-full max-w-none border-t border-border pt-6 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-foreground dark:text-gray-200">
                Questions &amp; answers
              </h3>
              {commentsLoading && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading…
                </div>
              )}
              {!commentsLoading && showQa && comments && (
                <div className="mt-3">
                  <ListingPublicCommentsDock
                    listingId={String(listing.id)}
                    listerId={listerId}
                    initialComments={comments}
                    currentUserId={viewerUserId}
                    ownerListerSession={ownerListerSession}
                    listerActiveViewingOthersListing={listerActiveViewingOthersListing}
                    desktopLayout="fullWidth"
                  />
                </div>
              )}
              {!commentsLoading && listing && !shouldShowPublicListingComments(listing, false) && (
                <p className="mt-2 text-sm text-muted-foreground dark:text-gray-500">
                  Public Q&amp;A isn&apos;t open for this listing.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Mobile: full-height sheet (map column is hidden on small screens). */
export function FindJobsMobileDetailSheet() {
  const lgUp = useLgUp();
  const { detailListing, setDetailListing } = useFindJobsMap();
  const open = Boolean(detailListing) && !lgUp;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && setDetailListing(null)}>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col gap-0 overflow-hidden p-0 lg:hidden"
      >
        <SheetTitle className="sr-only">Job details</SheetTitle>
        {detailListing ? (
          <FindJobsDetailPanelBody
            listing={detailListing}
            onBack={() => setDetailListing(null)}
            backLabel="Close"
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
