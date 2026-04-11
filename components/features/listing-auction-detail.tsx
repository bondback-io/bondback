"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bed, Bath, MapPin, Gavel, Briefcase } from "lucide-react";
import { formatCents } from "@/lib/listings";
import type { ListingRow } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { parseUtcTimestamp } from "@/lib/utils";
import { PlaceBidForm } from "@/components/features/place-bid-form";
import { BuyNowButton } from "@/components/features/buy-now-button";
import {
  BidHistoryTable,
  type BidWithBidder,
} from "@/components/features/bid-history-table";
import { requestEarlyBidAcceptance } from "@/lib/actions/early-bid-acceptance";
import { useToast } from "@/components/ui/use-toast";
import { showAppErrorToast } from "@/components/errors/show-app-error-toast";
import { logClientError } from "@/lib/errors/log-client-error";

export type ListingAuctionDetailProps = {
  listing: ListingRow;
  initialBids: BidWithBidder[];
  isCleaner: boolean;
  isListerOwner: boolean;
  /** Job row exists and is not cancelled — auction closed / work assigned */
  hasActiveJob: boolean;
  numericJobId: number | null;
  currentUserId: string | null;
};

export function ListingAuctionDetail({
  listing,
  initialBids,
  isCleaner,
  isListerOwner,
  hasActiveJob,
  numericJobId,
  currentUserId,
}: ListingAuctionDetailProps) {
  const router = useRouter();
  const { toast } = useToast();

  const isLive =
    listing.status === "live" && parseUtcTimestamp(listing.end_time) > Date.now();
  const isListingCancelled =
    String(listing.status ?? "").toLowerCase() === "cancelled";
  const showCleanerBidUi =
    isCleaner &&
    isLive &&
    !hasActiveJob &&
    !isListingCancelled;

  const handleAcceptBid = useCallback(
    async (bid: BidWithBidder) => {
      const result = await requestEarlyBidAcceptance(listing.id, bid.id);
      if (result.ok) {
        toast({
          title: "Bid accepted — job created",
          description:
            "The cleaner has been notified. They can proceed when you pay & start the job.",
        });
        router.refresh();
      } else {
        logClientError("earlyBidAccept", result.error, {
          listingId: listing.id,
          bidId: bid.id,
        });
        showAppErrorToast(toast, {
          flow: "earlyAccept",
          error: new Error(result.error ?? ""),
          context: "listingAuction.earlyAccept",
        });
      }
    },
    [listing.id, toast, router]
  );

  const hasPendingEarlyAcceptance = initialBids.some(
    (b) => b.status === "pending_confirmation"
  );

  const address = formatLocationWithState(
    listing.suburb ?? "",
    listing.postcode ?? ""
  );
  const beds = listing.bedrooms as number | undefined;
  const baths = listing.bathrooms as number | undefined;

  return (
    <div className="page-inner mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" asChild className="-ml-2 w-fit">
        <Link href={isListerOwner ? "/my-listings" : isCleaner ? "/dashboard" : "/jobs"}>
          ← Back
        </Link>
      </Button>

      {hasActiveJob && numericJobId != null ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Briefcase className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-medium">This listing has an active job.</span>
          </div>
          <Button asChild className="mt-3 rounded-xl" size="sm">
            <Link href={`/jobs/${numericJobId}`}>Open job #{numericJobId}</Link>
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-2xl leading-tight">
              {listing.title ?? "Bond clean"}
            </CardTitle>
            {isLive ? (
              <Badge className="shrink-0">Live</Badge>
            ) : (
              <Badge variant="secondary">{String(listing.status ?? "—")}</Badge>
            )}
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {address}
          </p>
          {(beds != null || baths != null) && (
            <p className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {beds != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Bed className="h-4 w-4" aria-hidden />
                  {beds} bed
                </span>
              )}
              {baths != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Bath className="h-4 w-4" aria-hidden />
                  {baths} bath
                </span>
              )}
            </p>
          )}
          {typeof listing.current_lowest_bid_cents === "number" && (
            <p className="text-sm">
              <span className="font-medium text-foreground">Current lowest bid: </span>
              <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCents(listing.current_lowest_bid_cents)}
              </span>
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Description</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {listing.description?.trim() ? listing.description : "No description provided."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card id="bids">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gavel className="h-5 w-5" aria-hidden />
            Bids
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <BidHistoryTable
            bids={initialBids}
            hasPendingEarlyAcceptance={hasPendingEarlyAcceptance}
            onAcceptBid={
              isListerOwner && !hasActiveJob ? handleAcceptBid : undefined
            }
          />
          {isListerOwner && !hasActiveJob && isLive && (
            <p className="text-sm text-muted-foreground">
              Use <strong>Accept bid</strong> on a row above when you&apos;re ready to proceed with
              that cleaner.
            </p>
          )}
        </CardContent>
      </Card>

      {showCleanerBidUi && (
        <Card id="place-bid">
          <CardHeader>
            <CardTitle className="text-lg">Place a bid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {typeof listing.buy_now_cents === "number" && listing.buy_now_cents > 0 && (
              <BuyNowButton
                listingId={listing.id}
                buyNowCents={listing.buy_now_cents}
                currentUserId={currentUserId}
              />
            )}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Your bid</h3>
              <PlaceBidForm
                listingId={listing.id}
                listing={listing}
                isCleaner={isCleaner}
                currentUserId={currentUserId}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {!isCleaner && !isListerOwner && (
        <p className="text-center text-sm text-muted-foreground">
          Sign in as a cleaner to bid, or as the lister to accept bids.
        </p>
      )}
    </div>
  );
}
