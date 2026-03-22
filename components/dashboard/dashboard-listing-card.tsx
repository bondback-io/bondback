"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "@/components/features/countdown-timer";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { formatCents, getListingCoverUrl } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { MapPin, List, Gavel, Pencil, XCircle, Bed, Bath, DollarSign, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListingRow } from "@/lib/listings";

export type DashboardListingCardProps = {
  listing: ListingRow;
  bidCount?: number;
  /** Hide Edit/Cancel; show only View Bids */
  compact?: boolean;
  /** When true, show "Ending soon" urgency badge (e.g. < 24h left) */
  isUrgent?: boolean;
  /** Platform fee percentage (from global settings) used for the fee display. */
  feePercentage?: number;
};

export function DashboardListingCard({
  listing,
  bidCount = 0,
  compact,
  isUrgent = false,
  feePercentage = 12,
}: DashboardListingCardProps) {
  const coverUrl = getListingCoverUrl(listing);
  const currentBid = (listing.current_lowest_bid_cents as number | null) ?? 0;
  const buyNow = listing.buy_now_cents;
  const currentPlatformFeeCents = Math.round((currentBid * feePercentage) / 100);
  const bedrooms = (listing as { bedrooms?: number }).bedrooms;
  const bathrooms = (listing as { bathrooms?: number }).bathrooms;

  return (
    <Card
      className={cn(
        "overflow-hidden border-border bg-card shadow-sm transition",
        "hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50",
        "active:scale-[0.99] sm:hover:scale-[1.01]"
      )}
    >
      <Link
        href={`/jobs/${listing.id}`}
        className="block"
        aria-label={`View listing: ${listing.title}`}
      >
        <div className="relative aspect-[16/10] w-full bg-muted dark:bg-gray-800">
          {coverUrl ? (
            <OptimizedImage
              src={coverUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400">
              <List className="h-10 w-10" />
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            <Badge className="bg-primary text-primary-foreground shadow-sm">
              Live
            </Badge>
            {isUrgent && (
              <Badge className="bg-amber-500 text-white shadow-sm dark:bg-amber-600">
                Ending soon
              </Badge>
            )}
          </div>
        </div>
      </Link>
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground dark:text-gray-100">
            {listing.title}
          </h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {formatLocationWithState(listing.suburb, listing.postcode)}
          </p>
        </div>
        {(bedrooms != null || bathrooms != null) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {bedrooms != null && (
              <span className="flex items-center gap-1">
                <Bed className="h-3.5 w-3.5" />
                {bedrooms}
              </span>
            )}
            {bathrooms != null && (
              <span className="flex items-center gap-1">
                <Bath className="h-3.5 w-3.5" />
                {bathrooms}
              </span>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold text-foreground dark:text-gray-100">
                {formatCents(currentBid)}
              </span>
              {buyNow != null && Number(buyNow) > 0 && (
                <span className="ml-0.5">· Buy now {formatCents(Number(buyNow))}</span>
              )}
            </span>
            <span className="flex items-center gap-1 font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <CountdownTimer
                endTime={listing.end_time}
                expiredLabel="Ended"
                urgentBelowHours={24}
                urgentClassName="text-destructive font-semibold"
              />
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Current Platform Fee ({feePercentage}%):{" "}
            <span className="font-semibold text-foreground dark:text-gray-100">
              {formatCents(currentPlatformFeeCents)}
            </span>
          </p>
        </div>
        {bidCount > 0 && (
          <p className="text-[11px] font-medium text-muted-foreground">
            <Gavel className="mr-1 inline h-3 w-3" />
            {bidCount} bid{bidCount !== 1 ? "s" : ""}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" className="rounded-full" variant="default">
            <Link href={`/jobs/${listing.id}`}>View Bids</Link>
          </Button>
          {!compact && (
            <>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link href={`/listings/${listing.id}/edit`}>
                  <Pencil className="mr-1 h-3 w-3" />
                  Edit
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Link href={`/my-listings?cancel=${listing.id}`}>
                  <XCircle className="mr-1 h-3 w-3" />
                  Cancel
                </Link>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
