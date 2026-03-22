"use client";



import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { OptimizedImage } from "@/components/ui/optimized-image";

import { formatCents, getListingCoverUrl } from "@/lib/listings";

import { formatLocationWithState } from "@/lib/state-from-postcode";

import { MapPin, Briefcase, MessageCircle, CheckCircle, Bed, Bath, DollarSign, Clock, Eye } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ListingRow } from "@/lib/listings";



type JobRow = {

  id: number | string;

  listing_id: string;

  status: string;

  cleaner_confirmed_complete?: boolean | null;

};



export type DashboardJobCardProps = {

  job: JobRow;

  listing: ListingRow | null;

  daysLeft: number | null;

  /** When true, show "Due soon" urgency badge (e.g. daysLeft <= 1) */

  isUrgent?: boolean;

};



export function DashboardJobCard({

  job,

  listing,

  daysLeft,

  isUrgent = false,

}: DashboardJobCardProps) {

  const statusLabel =

    job.status === "accepted"

      ? "Awaiting start"

      : job.status === "in_progress"

        ? "In progress"

        : job.status;

  const statusClass =

    job.status === "accepted"

      ? "bg-amber-500/90 text-white dark:bg-amber-500"

      : "bg-emerald-600/90 text-white dark:bg-emerald-500";

  const gross = listing?.current_lowest_bid_cents ?? 0;

  const bedrooms = listing ? (listing as { bedrooms?: number }).bedrooms : null;

  const bathrooms = listing ? (listing as { bathrooms?: number }).bathrooms : null;



  return (

    <Card

      className={cn(

        "overflow-hidden border-border bg-card shadow-sm transition",

        "hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50",

        "active:scale-[0.95] md:active:scale-[0.99] md:hover:scale-[1.01]"

      )}

    >

      <Link

        href={`/jobs/${job.id}`}

        className="block"

        aria-label={`View job: ${listing?.title ?? `Job #${job.id}`}`}

      >

        <div className="relative h-[200px] w-full bg-muted dark:bg-gray-800 md:aspect-[16/10] md:h-auto">

          {listing && getListingCoverUrl(listing) ? (

            <OptimizedImage

              src={getListingCoverUrl(listing)!}

              alt=""

              fill

              sizes="(max-width: 768px) 100vw, 33vw"

              className="h-full w-full"

            />

          ) : (

            <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400">

              <Briefcase className="h-12 w-12 md:h-10 md:w-10" />

            </div>

          )}

          <div className="absolute left-2 top-2 flex flex-wrap gap-1.5 md:gap-1">

            <Badge className={cn("px-2.5 py-1 text-xs font-bold md:text-xs", statusClass)}>

              {statusLabel}

            </Badge>

            {isUrgent && daysLeft != null && (

              <Badge className="bg-amber-500 px-2.5 py-1 text-xs font-bold text-white dark:bg-amber-600 md:text-xs">

                Due soon

              </Badge>

            )}

          </div>

        </div>

      </Link>

      <CardContent className="flex flex-1 flex-col gap-4 p-5 md:gap-3 md:p-4">

        <div>

          <h3 className="line-clamp-2 text-xl font-bold leading-snug text-foreground dark:text-gray-100 md:text-sm md:font-semibold md:leading-tight">

            {listing?.title ?? `Job #${job.id}`}

          </h3>

          <p className="mt-1.5 flex items-center gap-2 text-base text-muted-foreground md:gap-1 md:text-xs">

            <MapPin className="h-5 w-5 shrink-0 md:h-3 md:w-3" />

            {listing

              ? formatLocationWithState(listing.suburb, listing.postcode)

              : "—"}

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

        <div className="flex flex-wrap items-center justify-between gap-2">

          <span className="flex items-center gap-2 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100 md:text-xs md:font-semibold">

            <DollarSign className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400 md:h-3.5 md:w-3.5 md:text-current" />

            {formatCents(gross)}

          </span>

          {daysLeft != null && (

            <span

              className={cn(

                "flex items-center gap-1.5 text-sm md:text-xs",

                isUrgent

                  ? "font-bold text-amber-600 dark:text-amber-400"

                  : "text-muted-foreground"

              )}

            >

              <Clock className="h-5 w-5 shrink-0 md:h-3.5 md:w-3.5" />

              {daysLeft === 0

                ? "Due today"

                : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}

            </span>

          )}

        </div>



        {/* Mobile: full-width stacked actions */}

        <div className="mt-auto flex flex-col gap-2.5 pt-1 md:hidden">

          <Button asChild size="lg" variant="default" className="min-h-12 w-full rounded-xl text-base font-semibold active:scale-95">

            <Link href={`/jobs/${job.id}`} className="flex min-h-12 items-center justify-center gap-2">

              <Eye className="h-5 w-5" aria-hidden />

              View Details

            </Link>

          </Button>

          <Button asChild size="lg" variant="outline" className="min-h-12 w-full rounded-xl border-2 text-base font-semibold active:scale-95">

            <Link href={`/messages?job=${job.id}`} className="flex min-h-12 items-center justify-center gap-2">

              <MessageCircle className="h-5 w-5" aria-hidden />

              Message Lister

            </Link>

          </Button>

          {job.status === "in_progress" && (

            <Button

              asChild

              size="lg"

              className="min-h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold hover:bg-emerald-700 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500"

            >

              <Link href={`/jobs/${job.id}?complete=1`} className="flex min-h-12 items-center justify-center gap-2">

                <CheckCircle className="h-5 w-5" aria-hidden />

                Mark Complete

              </Link>

            </Button>

          )}

        </div>



        {/* Desktop: inline compact buttons */}

        <div className="mt-auto hidden flex-wrap gap-2 pt-1 md:flex">

          <Button asChild size="sm" className="rounded-full" variant="default">

            <Link href={`/jobs/${job.id}`}>View Job</Link>

          </Button>

          <Button asChild size="sm" variant="outline" className="rounded-full">

            <Link href={`/messages?job=${job.id}`}>

              <MessageCircle className="mr-1 h-3 w-3" />

              Message

            </Link>

          </Button>

          {job.status === "in_progress" && (

            <Button asChild size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">

              <Link href={`/jobs/${job.id}?complete=1`}>

                <CheckCircle className="mr-1 h-3 w-3" />

                Mark Complete

              </Link>

            </Button>

          )}

        </div>

      </CardContent>

    </Card>

  );

}

