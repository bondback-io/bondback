"use client";



import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { CountdownTimer } from "@/components/features/countdown-timer";

import { OptimizedImage } from "@/components/ui/optimized-image";

import { formatCents, getListingCoverUrl } from "@/lib/listings";

import { formatLocationWithState } from "@/lib/state-from-postcode";

import { MapPin, List, Gavel, Pencil, XCircle, Bed, Bath, DollarSign, Clock, Eye } from "lucide-react";

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

        "active:scale-[0.95] md:active:scale-[0.99] md:hover:scale-[1.01]"

      )}

    >

      <Link

        href={`/jobs/${listing.id}`}

        className="block"

        aria-label={`View listing: ${listing.title}`}

      >

        <div className="relative h-[200px] w-full bg-muted dark:bg-gray-800 md:aspect-[16/10] md:h-auto">

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

              <List className="h-12 w-12 md:h-10 md:w-10" />

            </div>

          )}

          <div className="absolute left-2 top-2 flex flex-wrap gap-1.5 md:gap-1">

            <Badge className="bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-sm md:text-xs">

              Live

            </Badge>

            {isUrgent && (

              <Badge className="bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm dark:bg-amber-600 md:text-xs">

                Ending soon

              </Badge>

            )}

          </div>

        </div>

      </Link>

      <CardContent className="flex flex-1 flex-col gap-4 p-5 md:gap-3 md:p-4">

        <div>

          <h3 className="line-clamp-2 text-xl font-bold leading-snug text-foreground dark:text-gray-100 md:text-sm md:font-semibold md:leading-tight">

            {listing.title}

          </h3>

          <p className="mt-1.5 flex items-center gap-2 text-base text-muted-foreground md:gap-1 md:text-xs">

            <MapPin className="h-5 w-5 shrink-0 md:h-3 md:w-3" />

            {formatLocationWithState(listing.suburb, listing.postcode)}

          </p>

        </div>

        {(bedrooms != null || bathrooms != null) && (

          <div className="flex items-center gap-4 text-sm text-muted-foreground md:gap-3 md:text-xs">

            {bedrooms != null && (

              <span className="flex items-center gap-1.5">

                <Bed className="h-5 w-5 md:h-3.5 md:w-3.5" />

                {bedrooms}

              </span>

            )}

            {bathrooms != null && (

              <span className="flex items-center gap-1.5">

                <Bath className="h-5 w-5 md:h-3.5 md:w-3.5" />

                {bathrooms}

              </span>

            )}

          </div>

        )}

        <div className="flex flex-col gap-2">

          <div className="flex flex-wrap items-center justify-between gap-2">

            <span className="flex flex-wrap items-center gap-2 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 md:text-xs md:font-semibold md:text-foreground md:dark:text-gray-100">

              <DollarSign className="h-6 w-6 shrink-0 md:h-3.5 md:w-3.5 md:text-current" />

              {formatCents(currentBid)}

              {buyNow != null && Number(buyNow) > 0 && (

                <span className="text-base font-semibold text-muted-foreground md:ml-0.5 md:text-xs">

                  · Buy now {formatCents(Number(buyNow))}

                </span>

              )}

            </span>

            <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground md:text-xs">

              <Clock className="h-5 w-5 shrink-0 md:h-3.5 md:w-3.5" />

              <CountdownTimer

                endTime={listing.end_time}

                expiredLabel="Ended"

                urgentBelowHours={24}

                urgentClassName="text-destructive font-semibold"

              />

            </span>

          </div>



          <p className="text-sm text-muted-foreground md:text-[11px]">

            Current Platform Fee ({feePercentage}%):{" "}

            <span className="font-semibold text-foreground dark:text-gray-100">

              {formatCents(currentPlatformFeeCents)}

            </span>

          </p>

        </div>

        {bidCount > 0 && (

          <p className="text-sm font-semibold text-muted-foreground md:text-[11px] md:font-medium">

            <Gavel className="mr-1 inline h-5 w-5 md:h-3 md:w-3" />

            {bidCount} bid{bidCount !== 1 ? "s" : ""}

          </p>

        )}



        {/* Mobile */}

        <div className="mt-auto flex flex-col gap-2.5 pt-1 md:hidden">

          <Button asChild size="lg" variant="default" className="min-h-12 w-full rounded-xl text-base font-semibold active:scale-95">

            <Link href={`/jobs/${listing.id}`} className="flex min-h-12 items-center justify-center gap-2">

              <Eye className="h-5 w-5" aria-hidden />

              View Details

            </Link>

          </Button>

          <Button asChild size="lg" variant="secondary" className="min-h-12 w-full rounded-xl text-base font-semibold active:scale-95">

            <Link href={`/jobs/${listing.id}`} className="flex min-h-12 items-center justify-center gap-2">

              <Gavel className="h-5 w-5" aria-hidden />

              View Bids

            </Link>

          </Button>

          {!compact && (

            <>

              <Button asChild size="lg" variant="outline" className="min-h-12 w-full rounded-xl border-2 text-base font-semibold active:scale-95">

                <Link href={`/listings/${listing.id}/edit`} className="flex min-h-12 items-center justify-center gap-2">

                  <Pencil className="h-5 w-5" aria-hidden />

                  Edit Listing

                </Link>

              </Button>

              <Button

                asChild

                size="lg"

                variant="outline"

                className="min-h-12 w-full rounded-xl border-2 border-destructive/40 text-base font-semibold text-destructive hover:bg-destructive/10 active:scale-95"

              >

                <Link href={`/my-listings?cancel=${listing.id}`} className="flex min-h-12 items-center justify-center gap-2">

                  <XCircle className="h-5 w-5" aria-hidden />

                  Cancel

                </Link>

              </Button>

            </>

          )}

        </div>



        {/* Desktop */}

        <div className="mt-auto hidden flex-wrap gap-2 pt-1 md:flex">

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

