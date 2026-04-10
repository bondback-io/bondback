"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  formatCents,
  formatPreferredCleaningDueLine,
  getListingCoverUrl,
} from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import {
  MapPin,
  Briefcase,
  MessageCircle,
  CheckCircle,
  Bed,
  Bath,
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
  agreed_amount_cents?: number | null;
};

export type DashboardJobCardProps = {
  job: JobRow;
  listing: ListingRow | null;
  daysLeft: number | null;
  /**
   * When true (all checklist items done + ≥3 after-photos), show Mark Complete and call
   * the same server action as job detail "Clean Complete — Request Payment".
   */
  canMarkCleanComplete?: boolean;
};

function MarkCompleteActionButton({
  jobId,
  className,
  iconClassName,
  size = "lg",
}: {
  jobId: number | string;
  className: string;
  iconClassName: string;
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const { markJobChecklistFinished } = await import("@/lib/actions/jobs");
      const res = await markJobChecklistFinished(jobId);
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not request payment",
          description: res.error ?? "Please try again.",
        });
        return;
      }
      toast({
        title: "Lister notified",
        description:
          "They can review your work and release payment. The review timer has started.",
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      disabled={loading}
      onClick={() => void onClick()}
      className={className}
    >
      <CheckCircle className={cn(iconClassName, "shrink-0")} aria-hidden />
      {loading ? "Submitting…" : "Mark Complete"}
    </Button>
  );
}

function DashboardJobCardInner({
  job,
  listing,
  daysLeft,
  canMarkCleanComplete = false,
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

  const agreed = job.agreed_amount_cents;
  const gross =
    agreed != null && agreed > 0
      ? agreed
      : (listing?.current_lowest_bid_cents ??
          listing?.buy_now_cents ??
          listing?.reserve_cents ??
          0);
  const bedrooms = listing ? (listing as { bedrooms?: number }).bedrooms : null;
  const bathrooms = listing ? (listing as { bathrooms?: number }).bathrooms : null;
  const title = listing?.title ?? `Job #${job.id}`;
  const cover = listing && getListingCoverUrl(listing) ? getListingCoverUrl(listing)! : null;

  const overdue = daysLeft != null && daysLeft < 0;
  const dueSoon =
    daysLeft != null && daysLeft >= 0 && daysLeft <= 1;
  const daysLine = formatPreferredCleaningDueLine(daysLeft);

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
              {overdue && (
                <Badge className="border border-red-600/90 bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground">
                  Overdue
                </Badge>
              )}
              {dueSoon && !overdue && (
                <Badge className="gap-1 border border-orange-400/80 bg-orange-500 px-2.5 py-1 text-xs font-bold text-white">
                  <Flame className="h-3.5 w-3.5" aria-hidden />
                  Hot
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-5 border-t border-border bg-card px-4 pb-6 pt-5 dark:border-gray-800 dark:bg-gray-950 sm:px-5">
          <h3 className="line-clamp-2 text-xl font-bold leading-tight tracking-tight text-foreground dark:text-gray-50">
            {title}
          </h3>

          <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.12] to-transparent p-4 dark:border-emerald-800/50 dark:from-emerald-950/45">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/90 dark:text-emerald-400/90">
              Job value
            </p>
            <p className="text-5xl font-extrabold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
              {formatCents(gross)}
            </p>
            {daysLine && (
              <div
                className={cn(
                  "mt-3 inline-flex rounded-xl border-2 px-3 py-2.5 text-lg font-bold",
                  overdue
                    ? "border-red-500/80 bg-red-500/15 text-red-950 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-100"
                    : dueSoon
                      ? "border-amber-400/80 bg-amber-500/15 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100"
                      : "border-border bg-muted/50 text-foreground dark:border-gray-600 dark:bg-gray-900/80 dark:text-gray-100"
                )}
              >
                <Clock className="mr-2 h-6 w-6 shrink-0 opacity-80" aria-hidden />
                {daysLine}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-lg font-semibold leading-snug text-foreground dark:text-gray-100">
              {listing ? formatLocationWithState(listing.suburb, listing.postcode) : "—"}
            </p>
            {(bedrooms != null || bathrooms != null) && (
              <p className="text-base text-muted-foreground dark:text-gray-400">
                {bedrooms != null ? `${bedrooms} bed` : ""}
                {bedrooms != null && bathrooms != null ? " · " : ""}
                {bathrooms != null ? `${bathrooms} bath` : ""}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3.5 pt-1">
            <Button asChild size="lg" variant="default" className="min-h-14 w-full rounded-xl text-lg font-semibold">
              <Link href={`/jobs/${job.id}`} className="flex items-center justify-center gap-2">
                <Eye className="h-6 w-6" aria-hidden />
                View Details
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-14 w-full rounded-xl border-2 text-lg font-semibold dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              <Link href={`/messages?job=${job.id}`} className="flex items-center justify-center gap-2">
                <MessageCircle className="h-6 w-6" aria-hidden />
                Message Lister
              </Link>
            </Button>
            {job.status === "in_progress" && canMarkCleanComplete && (
              <MarkCompleteActionButton
                jobId={job.id}
                size="lg"
                className="min-h-14 w-full rounded-xl bg-emerald-600 text-lg font-semibold hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                iconClassName="mr-2 h-6 w-6"
              />
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
              {overdue && (
                <Badge className="bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground">
                  Overdue
                </Badge>
              )}
              {dueSoon && !overdue && (
                <Badge className="bg-amber-500 px-2.5 py-1 text-xs font-bold text-white dark:bg-amber-600">
                  Due soon
                </Badge>
              )}
            </div>
          </div>
        </Link>

        <CardContent className="flex flex-1 flex-col gap-4 p-5">
          <div>
            <h3 className="line-clamp-2 text-base font-bold leading-tight text-foreground dark:text-gray-100">
              {title}
            </h3>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              {listing ? formatLocationWithState(listing.suburb, listing.postcode) : "—"}
            </p>
          </div>
          {(bedrooms != null || bathrooms != null) && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {bedrooms != null && (
                <span className="flex items-center gap-1.5 font-medium">
                  <Bed className="h-4 w-4" />
                  {bedrooms} bed
                </span>
              )}
              {bathrooms != null && (
                <span className="flex items-center gap-1.5 font-medium">
                  <Bath className="h-4 w-4" />
                  {bathrooms} bath
                </span>
              )}
            </div>
          )}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-3 dark:border-emerald-800/40 dark:bg-emerald-950/35">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatCents(gross)}
              </span>
              {daysLine != null && (
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-semibold",
                    overdue
                      ? "text-destructive dark:text-red-400"
                      : dueSoon
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                  )}
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  {daysLine}
                </span>
              )}
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2.5 pt-1">
            <Button asChild className="min-h-11 rounded-full px-5 text-sm font-semibold" variant="default">
              <Link href={`/jobs/${job.id}`}>View Job</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 rounded-full px-5 text-sm font-semibold">
              <Link href={`/messages?job=${job.id}`}>
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Message
              </Link>
            </Button>
            {job.status === "in_progress" && canMarkCleanComplete && (
              <MarkCompleteActionButton
                jobId={job.id}
                size="default"
                className="min-h-11 rounded-full bg-emerald-600 px-5 text-sm font-semibold hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                iconClassName="mr-1.5 h-4 w-4"
              />
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export const DashboardJobCard = React.memo(DashboardJobCardInner);
DashboardJobCard.displayName = "DashboardJobCard";
