"use client";

import { memo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "@/components/features/countdown-timer";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { formatCents, getListingCoverUrl } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import {
  MapPin,
  List,
  Gavel,
  XCircle,
  Bed,
  Bath,
  DollarSign,
  Clock,
  Eye,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListingRow } from "@/lib/listings";

export type DashboardListingCardProps = {
  listing: ListingRow;
  bidCount?: number;
  compact?: boolean;
  isUrgent?: boolean;
  feePercentage?: number;
  /**
   * When set, Cancel uses a button + handler. Otherwise links to /my-listings?cancel=…
   */
  onCancelClick?: () => void;
};

function DashboardListingCardInner({
  listing,
  bidCount = 0,
  compact,
  isUrgent = false,
  feePercentage = 12,
  onCancelClick,
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
        "active:scale-[0.95] md:active:scale-[0.99] md:hover:scale-[1.01]"
      )}
    >
      {/* Mobile */}
      <div className="md:hidden">
        <div className="relative h-[200px] w-full min-h-[180px] max-h-[220px] overflow-hidden bg-muted dark:bg-gray-800">
          <Link href={`/jobs/${listing.id}`} className="absolute inset-0 block" aria-label={`View listing: ${listing.title}`}>
            {coverUrl ? (
              <OptimizedImage src={coverUrl} alt="" fill sizes="100vw" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400">
                <List className="h-14 w-14" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" aria-hidden />
          </Link>
          <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2">
            <Badge className="bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-sm">Live</Badge>
            {isUrgent && (
              <Badge className="gap-1 border border-orange-400/80 bg-orange-500 px-2.5 py-1 text-xs font-bold text-white">
                <Flame className="h-3.5 w-3.5" aria-hidden />
                Hot
              </Badge>
            )}
          </div>
        </div>
        <div className="space-y-4 border-t border-border bg-card px-4 pb-5 pt-4 dark:border-gray-800 dark:bg-gray-950">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
              Current bid
            </p>
            <p className="text-4xl font-extrabold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
              {formatCents(currentBid)}
            </p>
            {buyNow != null && Number(buyNow) > 0 && (
              <p className="mt-1 text-sm font-semibold text-muted-foreground dark:text-gray-300">
                Buy now {formatCents(Number(buyNow))}
              </p>
            )}
            <div className="mt-2 inline-flex items-center gap-2 rounded-xl border-2 border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-base font-bold text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/50 dark:text-emerald-100">
              <Clock className="h-5 w-5 shrink-0" aria-hidden />
              <CountdownTimer
                endTime={listing.end_time}
                expiredLabel="Ended"
                urgentBelowHours={24}
                urgentClassName="text-destructive font-bold"
              />
            </div>
          </div>
          <p className="text-base font-medium leading-snug text-foreground dark:text-gray-100">
            {formatLocationWithState(listing.suburb, listing.postcode)}
          </p>
          {(bedrooms != null || bathrooms != null) && (
            <p className="text-base text-muted-foreground dark:text-gray-400">
              {bedrooms != null ? `${bedrooms} bed` : ""}
              {bedrooms != null && bathrooms != null ? " · " : ""}
              {bathrooms != null ? `${bathrooms} bath` : ""}
            </p>
          )}
          <p className="line-clamp-2 text-sm font-semibold text-foreground dark:text-gray-100">{listing.title}</p>
          {bidCount > 0 && (
            <p className="text-sm font-semibold text-muted-foreground dark:text-gray-400">
              <Gavel className="mr-1 inline h-4 w-4" />
              {bidCount} bid{bidCount !== 1 ? "s" : ""}
            </p>
          )}
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Platform fee ({feePercentage}%):{" "}
            <span className="font-semibold text-foreground dark:text-gray-100">{formatCents(currentPlatformFeeCents)}</span>
          </p>

          <div className="flex flex-col gap-3 pt-1">
            <Button asChild size="lg" variant="default" className="min-h-12 w-full rounded-xl text-base font-semibold">
              <Link href={`/jobs/${listing.id}`} className="flex items-center justify-center gap-2">
                <Eye className="h-5 w-5" aria-hidden />
                View Listing
              </Link>
            </Button>
            {!compact && (
              <>
                {onCancelClick ? (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="relative z-20 min-h-12 w-full gap-2 rounded-xl border-2 border-destructive/40 text-base font-semibold text-destructive hover:bg-destructive/10"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelClick();
                    }}
                  >
                    <XCircle className="h-5 w-5 shrink-0" aria-hidden />
                    Cancel
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="relative z-20 min-h-12 w-full rounded-xl border-2 border-destructive/40 text-base font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <Link
                      href={`/my-listings?cancel=${listing.id}`}
                      className="flex items-center justify-center gap-2"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <XCircle className="h-5 w-5" aria-hidden />
                      Cancel
                    </Link>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <Link href={`/jobs/${listing.id}`} className="block" aria-label={`View listing: ${listing.title}`}>
          <div className="relative aspect-[16/10] w-full bg-muted dark:bg-gray-800">
            {coverUrl ? (
              <OptimizedImage src={coverUrl} alt="" fill sizes="33vw" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400">
                <List className="h-10 w-10" />
              </div>
            )}
            <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
              <Badge className="bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-sm">Live</Badge>
              {isUrgent && (
                <Badge className="bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm dark:bg-amber-600">
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
            <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {formatLocationWithState(listing.suburb, listing.postcode)}
            </p>
          </div>
          {(bedrooms != null || bathrooms != null) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {bedrooms != null && (
                <span className="flex items-center gap-1.5">
                  <Bed className="h-3.5 w-3.5" />
                  {bedrooms}
                </span>
              )}
              {bathrooms != null && (
                <span className="flex items-center gap-1.5">
                  <Bath className="h-3.5 w-3.5" />
                  {bathrooms}
                </span>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums text-foreground dark:text-gray-100">
                <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {formatCents(currentBid)}
                {buyNow != null && Number(buyNow) > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    · Buy now {formatCents(Number(buyNow))}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
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
              <span className="font-semibold text-foreground dark:text-gray-100">{formatCents(currentPlatformFeeCents)}</span>
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
              <Link href={`/jobs/${listing.id}`}>View Listing</Link>
            </Button>
            {!compact && (
              <>
                {onCancelClick ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="relative z-20 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelClick();
                    }}
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    Cancel
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="relative z-20 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Link
                      href={`/my-listings?cancel=${listing.id}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      Cancel
                    </Link>
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export const DashboardListingCard = memo(DashboardListingCardInner);
DashboardListingCard.displayName = "DashboardListingCard";
