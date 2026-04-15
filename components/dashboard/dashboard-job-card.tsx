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
  getListingSecondImageUrl,
  listingTitleWithoutSuburbSuffix,
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
  Camera,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListingRow } from "@/lib/listings";
import { detailUrlForCardItem } from "@/lib/navigation/listing-or-job-href";

type JobRow = {
  id: number | string;
  listing_id: string;
  status: string;
  winner_id?: string | null;
  cleaner_id?: string | null;
  cleaner_confirmed_complete?: boolean | null;
  agreed_amount_cents?: number | null;
};

function jobCardStatusPresentation(status: string): {
  label: string;
  badgeClass: string;
} {
  const s = String(status ?? "").toLowerCase();
  switch (s) {
    case "accepted":
      return {
        label: "Awaiting start",
        badgeClass: "bg-amber-500/90 text-white dark:bg-amber-500",
      };
    case "in_progress":
      return {
        label: "In progress",
        badgeClass: "bg-emerald-600/90 text-white dark:bg-emerald-500",
      };
    case "completed_pending_approval":
      return {
        label: "Waiting for approval",
        badgeClass: "bg-violet-600/95 text-white dark:bg-violet-500",
      };
    case "completed":
      return {
        label: "Completed",
        badgeClass: "bg-slate-600/90 text-white dark:bg-slate-500",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        badgeClass: "bg-destructive text-destructive-foreground",
      };
    case "disputed":
    case "in_review":
      return {
        label: "Disputed",
        badgeClass: "bg-orange-600/95 text-white dark:bg-orange-600",
      };
    default:
      return {
        label: s.replace(/_/g, " ") || "Active",
        badgeClass: "bg-muted text-foreground dark:bg-gray-700 dark:text-gray-100",
      };
  }
}

export type DashboardJobCardProps = {
  job: JobRow;
  listing: ListingRow | null;
  daysLeft: number | null;
  /**
   * When true (all checklist items done + ≥3 after-photos), show Mark Complete and call
   * the same server action as job detail "Clean Complete — Request Payment".
   */
  canMarkCleanComplete?: boolean;
  /** Other party on the job — lister name when you are the cleaner, cleaner name when you are the lister. */
  counterpartyName?: string | null;
  counterpartyRole?: "lister" | "cleaner";
  /** Defaults to cleaner (cleaner dashboard). */
  viewerRole?: "cleaner" | "lister";
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
  counterpartyName,
  counterpartyRole,
  viewerRole = "cleaner",
}: DashboardJobCardProps) {
  const { label: statusLabel, badgeClass: statusClass } = jobCardStatusPresentation(job.status);

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
  const rawTitle = listing?.title ?? (job as { title?: string | null }).title ?? `Job #${job.id}`;
  const title = listingTitleWithoutSuburbSuffix(rawTitle, listing?.suburb);
  const cover = listing && getListingCoverUrl(listing) ? getListingCoverUrl(listing)! : null;
  const secondImage = listing ? getListingSecondImageUrl(listing) : null;

  const overdue = daysLeft != null && daysLeft < 0;
  const dueSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 1;
  const daysLine = formatPreferredCleaningDueLine(daysLeft);

  const detailUrl = detailUrlForCardItem({
    id: job.id,
    listing_id: job.listing_id,
    status: job.status,
    winner_id: job.winner_id,
    cleaner_id: job.cleaner_id,
  });

  const jobNumericId = typeof job.id === "number" ? job.id : Number(job.id);
  const messagesJobParam = Number.isFinite(jobNumericId) ? jobNumericId : job.id;

  const messagePeerLabel =
    viewerRole === "cleaner" ? "Message Lister" : "Message Cleaner";
  const counterpartyLine =
    counterpartyName != null && String(counterpartyName).trim() !== ""
      ? `${counterpartyRole === "lister" ? "Lister" : "Cleaner"}: ${String(counterpartyName).trim()}`
      : null;

  const showAfterPhotosCta =
    viewerRole === "cleaner" && job.status === "in_progress";
  const showReviewReleaseCta =
    viewerRole === "lister" && job.status === "completed_pending_approval";

  const HeroImages = () => (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-muted dark:bg-gray-800",
        secondImage ? "grid min-h-[200px] grid-cols-2 gap-0.5" : "h-[200px] min-h-[180px] max-h-[220px]"
      )}
    >
      <Link
        href={detailUrl}
        className="relative block min-h-[180px] w-full no-underline hover:no-underline"
        aria-label={`View job: ${title}`}
      >
        {cover ? (
          <OptimizedImage src={cover} alt="" fill sizes="50vw" className="object-cover" />
        ) : (
          <div className="flex h-full min-h-[180px] w-full items-center justify-center text-muted-foreground dark:text-gray-400">
            <Briefcase className="h-14 w-14" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent md:from-black/55 md:via-black/10" aria-hidden />
      </Link>
      {secondImage ? (
        <Link
          href={detailUrl}
          className="relative block min-h-[180px] w-full no-underline hover:no-underline"
          aria-label={`More photos: ${title}`}
        >
          <OptimizedImage src={secondImage} alt="" fill sizes="50vw" className="object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent md:from-black/45" aria-hidden />
        </Link>
      ) : null}
    </div>
  );

  return (
    <Card
      className={cn(
        "overflow-hidden border-border bg-card shadow-sm transition",
        "hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50",
        "active:scale-[0.98] md:active:scale-[0.995] md:hover:scale-[1.01]"
      )}
    >
      {/* Mobile */}
      <div className="md:hidden">
        <div className="relative">
          <HeroImages />
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
          <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-foreground dark:text-gray-50 sm:text-xl sm:font-bold sm:leading-tight">
            {title}
          </h3>

          {counterpartyLine && (
            <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 px-3 py-2.5 text-sm font-semibold text-foreground dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-100">
              <User className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="line-clamp-2">{counterpartyLine}</span>
            </div>
          )}

          <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.12] to-transparent p-4 dark:border-emerald-800/50 dark:from-emerald-950/45">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/90 dark:text-emerald-400/90">
              {agreed != null && agreed > 0 ? "Agreed price" : "Job value"}
            </p>
            <p className="text-5xl font-extrabold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
              {formatCents(gross)}
            </p>
            {daysLine && (
              <>
                <div
                  className={cn(
                    "mt-3 inline-flex rounded-xl border-2 px-3 py-2.5 text-lg font-bold",
                    overdue
                      ? "border-red-500/80 bg-red-500/15 text-red-950 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-100"
                      : dueSoon
                        ? "border-amber-400/80 bg-amber-500/15 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100"
                        : "border-border bg-muted/50 text-foreground dark:border-gray-600 dark:bg-gray-900/80 dark:text-gray-100"
                  )}
                  title="Countdown to the latest date the lister chose for this clean (preferred dates, or move-out if none)."
                >
                  <Clock className="mr-2 h-6 w-6 shrink-0 opacity-80" aria-hidden />
                  {daysLine}
                </div>
                <p className="mt-2 max-w-prose text-[10px] font-medium leading-snug text-emerald-900/75 dark:text-emerald-300/75">
                  Uses the listing&apos;s preferred clean dates or move-out date — not payment or auction
                  timing.
                </p>
              </>
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
              <Link prefetch href={detailUrl} className="flex items-center justify-center gap-2 no-underline hover:no-underline">
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
              <Link
                prefetch
                href={`/messages?job=${messagesJobParam}`}
                className="flex items-center justify-center gap-2 no-underline hover:no-underline"
              >
                <MessageCircle className="h-6 w-6" aria-hidden />
                {messagePeerLabel}
              </Link>
            </Button>
            {showAfterPhotosCta && (
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="min-h-14 w-full rounded-xl border border-sky-500/30 bg-sky-500/10 text-lg font-semibold text-sky-900 hover:bg-sky-500/20 dark:border-sky-700/50 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-950/80"
              >
                <Link
                  prefetch
                  href={`/jobs/${encodeURIComponent(String(job.id))}#job-after-photos`}
                  className="flex items-center justify-center gap-2 no-underline hover:no-underline"
                >
                  <Camera className="h-6 w-6 shrink-0" aria-hidden />
                  Upload after photos
                </Link>
              </Button>
            )}
            {showReviewReleaseCta && (
              <Button
                asChild
                size="lg"
                className="min-h-14 w-full rounded-xl bg-violet-600 text-lg font-semibold text-white hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
              >
                <Link prefetch href={detailUrl} className="flex items-center justify-center gap-2 no-underline hover:no-underline">
                  <Sparkles className="h-6 w-6 shrink-0" aria-hidden />
                  Review &amp; release
                </Link>
              </Button>
            )}
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
          href={detailUrl}
          className="block no-underline hover:no-underline"
          aria-label={`View job: ${title}`}
        >
          <div
            className={cn(
              "relative w-full bg-muted dark:bg-gray-800",
              secondImage ? "grid aspect-[16/10] grid-cols-2 gap-0.5" : "aspect-[16/10]"
            )}
          >
            <div className="relative min-h-0 w-full">
              {cover ? (
                <OptimizedImage src={cover} alt="" fill sizes="25vw" className="object-cover" />
              ) : (
                <div className="flex h-full min-h-[160px] w-full items-center justify-center text-muted-foreground dark:text-gray-400">
                  <Briefcase className="h-10 w-10" />
                </div>
              )}
            </div>
            {secondImage ? (
              <div className="relative min-h-0 w-full">
                <OptimizedImage src={secondImage} alt="" fill sizes="25vw" className="object-cover" />
              </div>
            ) : null}
            <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1.5">
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
          {counterpartyLine && (
            <p className="flex items-start gap-2 text-sm font-semibold text-foreground dark:text-gray-100">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              {counterpartyLine}
            </p>
          )}
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
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-400/90">
              {agreed != null && agreed > 0 ? "Agreed price" : "Job value"}
            </p>
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
                  title="Latest date the lister chose for this clean (preferred dates or move-out). Not tied to payment release."
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  {daysLine}
                </span>
              )}
            </div>
            {daysLine != null && (
              <p className="mt-1.5 text-[10px] font-medium leading-snug text-emerald-800/70 dark:text-emerald-400/75">
                Preferred clean timing — not payment or auction timing.
              </p>
            )}
          </div>
          <div className="mt-auto flex flex-wrap gap-2.5 pt-1">
            <Button asChild className="min-h-11 rounded-full px-5 text-sm font-semibold" variant="default">
              <Link prefetch href={detailUrl} className="no-underline hover:no-underline">
                View Job
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 rounded-full px-5 text-sm font-semibold">
              <Link prefetch href={`/messages?job=${messagesJobParam}`} className="no-underline hover:no-underline">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                {viewerRole === "cleaner" ? "Message" : "Chat"}
              </Link>
            </Button>
            {showAfterPhotosCta && (
              <Button
                asChild
                variant="secondary"
                className="min-h-11 rounded-full border border-sky-500/30 bg-sky-500/10 px-5 text-sm font-semibold text-sky-900 dark:border-sky-700/40 dark:bg-sky-950/40 dark:text-sky-100"
              >
                <Link
                  prefetch
                  href={`/jobs/${encodeURIComponent(String(job.id))}#job-after-photos`}
                  className="no-underline hover:no-underline"
                >
                  <Camera className="mr-1.5 h-4 w-4" />
                  After photos
                </Link>
              </Button>
            )}
            {showReviewReleaseCta && (
              <Button
                asChild
                className="min-h-11 rounded-full bg-violet-600 px-5 text-sm font-semibold hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
              >
                <Link prefetch href={detailUrl} className="no-underline hover:no-underline">
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Review
                </Link>
              </Button>
            )}
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
