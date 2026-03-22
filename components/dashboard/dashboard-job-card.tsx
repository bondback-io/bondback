"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { formatCents, getListingCoverUrl } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import {
  MapPin,
  Briefcase,
  MessageCircle,
  CheckCircle,
  Bed,
  Bath,
  DollarSign,
  Clock,
  Eye,
  Flame,
} from "lucide-react";
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
  const title = listing?.title ?? `Job #${job.id}`;
  const cover = listing && getListingCoverUrl(listing) ? getListingCoverUrl(listing)! : null;

  const daysLine =
    daysLeft != null
      ? daysLeft === 0
        ? "Due today"
        : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
      : null;

  return (
    <Card
      className={cn(
        "overflow-hidden border-border bg-card shadow-sm transition",
        "hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50",
        "active:scale-[0.95] md:active:scale-[0.99] md:hover:scale-[1.01]"
      )}
    >
      {/* Mobile: hero + bold price + CTAs */}
      <div className="md:hidden">
        <div className="relative h-[200px] w-full min-h-[180px] max-h-[220px] overflow-hidden bg-muted dark:bg-gray-800">
          <Link
            href={`/jobs/${job.id}`}
            className="absolute inset-0 block"
            aria-label={`View job: ${title}`}
          >
            {cover ? (
              <OptimizedImage
                src={cover}
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400">
                <Briefcase className="h-14 w-14" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" aria-hidden />
          </Link>
          <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge className={cn("px-2.5 py-1 text-xs font-bold shadow-sm", statusClass)}>
                {statusLabel}
              </Badge>
              {isUrgent && daysLeft != null && (
                <Badge className="gap-1 border border-orange-400/80 bg-orange-500 px-2.5 py-1 text-xs font-bold text-white">
                  <Flame className="h-3.5 w-3.5" aria-hidden />
                  Hot
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-4 border-t border-border bg-card px-4 pb-5 pt-4 dark:border-gray-800 dark:bg-gray-950">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
              Job value
            </p>
            <p className="text-4xl font-extrabold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
              {formatCents(gross)}
            </p>
            {daysLine && (
              <div
                className={cn(
                  "mt-2 inline-flex rounded-xl border-2 px-3 py-2 text-base font-bold",
                  isUrgent
                    ? "border-amber-400/80 bg-amber-500/15 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100"
                    : "border-border bg-muted/40 text-foreground dark:border-gray-600 dark:bg-gray-900/80 dark:text-gray-100"
                )}
              >
                <Clock className="mr-2 h-5 w-5 shrink-0 opacity-80" aria-hidden />
                {daysLine}
              </div>
            )}
          </div>
          <p className="text-base font-medium leading-snug text-foreground dark:text-gray-100">
            {listing ? formatLocationWithState(listing.suburb, listing.postcode) : "—"}
          </p>
          {(bedrooms != null || bathrooms != null) && (
            <p className="text-base text-muted-foreground dark:text-gray-400">
              {bedrooms != null ? `${bedrooms} bed` : ""}
              {bedrooms != null && bathrooms != null ? " · " : ""}
              {bathrooms != null ? `${bathrooms} bath` : ""}
            </p>
          )}
          <p className="line-clamp-2 text-sm font-semibold text-foreground/90 dark:text-gray-200">{title}</p>

          <div className="flex flex-col gap-3 pt-1">
            <Button asChild size="lg" variant="default" className="min-h-12 w-full rounded-xl text-base font-semibold">
              <Link href={`/jobs/${job.id}`} className="flex items-center justify-center gap-2">
                <Eye className="h-5 w-5" aria-hidden />
                View Details
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-12 w-full rounded-xl border-2 text-base font-semibold dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              <Link href={`/messages?job=${job.id}`} className="flex items-center justify-center gap-2">
                <MessageCircle className="h-5 w-5" aria-hidden />
                Message Lister
              </Link>
            </Button>
            {job.status === "in_progress" && (
              <Button
                asChild
                size="lg"
                className="min-h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Link href={`/jobs/${job.id}?complete=1`} className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5" aria-hidden />
                  Mark Complete
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <Link
          href={`/jobs/${job.id}`}
          className="block"
          aria-label={`View job: ${title}`}
        >
          <div className="relative aspect-[16/10] w-full bg-muted dark:bg-gray-800">
            {cover ? (
              <OptimizedImage src={cover} alt="" fill sizes="33vw" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400">
                <Briefcase className="h-10 w-10" />
              </div>
            )}
            <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
              <Badge className={cn("px-2.5 py-1 text-xs font-bold", statusClass)}>{statusLabel}</Badge>
              {isUrgent && daysLeft != null && (
                <Badge className="bg-amber-500 px-2.5 py-1 text-xs font-bold text-white dark:bg-amber-600">
                  Due soon
                </Badge>
              )}
            </div>
          </div>
        </Link>

        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground dark:text-gray-100">
              {title}
            </h3>
            <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {listing ? formatLocationWithState(listing.suburb, listing.postcode) : "—"}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold tabular-nums text-foreground dark:text-gray-100">
              <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {formatCents(gross)}
            </span>
            {daysLeft != null && (
              <span
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  isUrgent ? "font-bold text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                )}
              >
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {daysLeft === 0 ? "Due today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
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
      </div>
    </Card>
  );
}
