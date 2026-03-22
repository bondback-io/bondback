"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { formatCents, getListingCoverUrl } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { MapPin, Briefcase, MessageCircle, CheckCircle, Bed, Bath, DollarSign, Clock } from "lucide-react";
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
        "active:scale-[0.99] sm:hover:scale-[1.01]"
      )}
    >
      <Link
        href={`/jobs/${job.id}`}
        className="block"
        aria-label={`View job: ${listing?.title ?? `Job #${job.id}`}`}
      >
        <div className="relative aspect-[16/10] w-full bg-muted dark:bg-gray-800">
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
              <Briefcase className="h-10 w-10" />
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            <Badge className={cn("text-xs", statusClass)}>
              {statusLabel}
            </Badge>
            {isUrgent && daysLeft != null && (
              <Badge className="bg-amber-500 text-white text-xs dark:bg-amber-600">
                Due soon
              </Badge>
            )}
          </div>
        </div>
      </Link>
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground dark:text-gray-100">
            {listing?.title ?? `Job #${job.id}`}
          </h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {listing
              ? formatLocationWithState(listing.suburb, listing.postcode)
              : "—"}
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
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-foreground dark:text-gray-100">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            {formatCents(gross)}
          </span>
          {daysLeft != null && (
            <span className={cn(
              "flex items-center gap-1 text-muted-foreground",
              isUrgent && "font-semibold text-amber-600 dark:text-amber-400"
            )}>
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {daysLeft === 0
                ? "Due today"
                : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
            </span>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
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
