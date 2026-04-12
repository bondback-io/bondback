"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatCents,
  formatPreferredCleaningDueLine,
  getListingCoverUrl,
} from "@/lib/listings";
import type { ListingRow } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { cn } from "@/lib/utils";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { detailUrlForCardItem } from "@/lib/navigation/listing-or-job-href";
import {
  Briefcase,
  MapPin,
  MoreVertical,
  Eye,
  MessageCircle,
  Flag,
  Share2,
} from "lucide-react";

type JobRow = {
  id: string;
  listing_id: string;
  status: string;
  winner_id?: string | null;
  cleaner_id?: string | null;
};

export type ActiveJobCardProps = {
  job: JobRow;
  listing: ListingRow | null;
  daysLeft: number | null;
};

export function ActiveJobCard({ job, listing, daysLeft }: ActiveJobCardProps) {
  const router = useRouter();
  const dueLine = formatPreferredCleaningDueLine(daysLeft);
  const overdue = daysLeft != null && daysLeft < 0;
  const jobHref = detailUrlForCardItem({
    id: job.id,
    listing_id: job.listing_id,
    status: job.status,
    winner_id: job.winner_id,
    cleaner_id: job.cleaner_id,
  });
  const title = listing?.title ?? "Bond clean job";
  const thumb = getListingCoverUrl(listing);
  const isDisputed =
    job.status === "disputed" || job.status === "in_review" || job.status === "dispute_negotiating";

  const handleShare = () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}${jobHref}` : jobHref;
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {});
    }
  };

  const statusLine =
    job.status === "disputed" || job.status === "in_review" || job.status === "dispute_negotiating"
      ? "Disputed"
      : job.status === "in_progress"
        ? "In progress"
        : job.status === "accepted"
          ? "Awaiting approval"
          : job.status === "completed"
            ? "Completed"
            : job.status;

  const statusPillClass =
    job.status === "disputed" || job.status === "in_review" || job.status === "dispute_negotiating"
      ? "border-red-400/80 bg-red-500/15 text-red-900 dark:border-red-600/50 dark:bg-red-950/60 dark:text-red-100"
      : job.status === "in_progress"
        ? "border-emerald-300/80 bg-emerald-500/15 text-emerald-900 dark:border-emerald-600/50 dark:bg-emerald-950/60 dark:text-emerald-100"
        : job.status === "accepted"
          ? "border-sky-400/80 bg-sky-500/15 text-sky-900 dark:border-sky-600/50 dark:bg-sky-950/60 dark:text-sky-100"
          : job.status === "completed"
            ? "border-emerald-300/80 bg-emerald-500/15 text-emerald-900 dark:border-emerald-600/50 dark:bg-emerald-950/60 dark:text-emerald-100"
            : "border-border bg-muted text-muted-foreground dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300";

  const bedsBaths =
    listing != null
      ? `${listing.bedrooms} bed · ${listing.bathrooms} bath`
      : null;

  return (
    <>
      {/* Mobile (&lt;768px): thumb-friendly hero + bold price + large CTAs */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg ring-1 ring-border/80 dark:border-gray-800 dark:bg-gray-950 dark:ring-gray-800 md:hidden">
        <div className="relative h-[220px] min-h-[200px] max-h-[260px] w-full overflow-hidden bg-muted dark:bg-gray-800">
          <Link
            href={jobHref}
            className="absolute inset-0 z-0 block"
            aria-label={`View job: ${title}`}
          >
            {thumb ? (
              <Image
                src={thumb}
                alt={listing?.title ? `Photo for ${listing.title}` : "Job photo"}
                fill
                quality={75}
                className="object-cover"
                sizes="100vw"
                loading="lazy"
                placeholder="blur"
                blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400" aria-hidden>
                <Briefcase className="h-10 w-10" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent md:from-black/55 md:via-black/12" aria-hidden />
          </Link>
          <div className="absolute left-3 top-3 z-10 min-w-0" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 shrink-0 rounded-full bg-background/95 text-muted-foreground shadow-md hover:bg-background dark:bg-gray-900/95"
                  aria-label="Open job actions menu"
                >
                  <MoreVertical className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={jobHref} className="flex cursor-pointer items-center gap-2">
                    <Eye className="h-4 w-4" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/messages?job=${job.id}`} className="flex cursor-pointer items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Message Lister
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile#support" className="flex cursor-pointer items-center gap-2">
                    <Flag className="h-4 w-4" />
                    Report Issue
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleShare} className="flex cursor-pointer items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Share Listing
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-col gap-5 border-t border-border px-4 pb-6 pt-5 dark:border-gray-800 sm:px-5">
          <h3 className="line-clamp-2 text-xl font-bold leading-tight tracking-tight text-foreground dark:text-gray-50">
            {title}
          </h3>

          <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.12] to-transparent p-4 dark:border-emerald-800/50 dark:from-emerald-950/45">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/90 dark:text-emerald-400/90">
              Job price
            </p>
            <p className="text-5xl font-extrabold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
              {listing ? formatCents(listing.current_lowest_bid_cents ?? 0) : "—"}
            </p>
            <div
              className={cn(
                "mt-3 inline-flex w-fit max-w-full rounded-xl border-2 px-3 py-2.5 text-lg font-bold leading-tight",
                statusPillClass
              )}
            >
              {statusLine}
            </div>
            {dueLine != null && (
              <p
                className={cn(
                  "mt-2 text-base font-semibold",
                  overdue
                    ? "text-destructive dark:text-red-400"
                    : "text-muted-foreground dark:text-gray-400"
                )}
              >
                {dueLine}
              </p>
            )}
          </div>

          {listing && (
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-lg font-semibold text-foreground dark:text-gray-100">
                <MapPin className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-500" aria-hidden />
                {formatLocationWithState(listing.suburb, listing.postcode)}
              </p>
              {bedsBaths && (
                <p className="text-base text-muted-foreground dark:text-gray-400">{bedsBaths}</p>
              )}
            </div>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground dark:text-gray-500">
            Price includes 12% platform fee paid by the lister
          </p>

          <div className="flex flex-col gap-3.5 pt-1">
            {isDisputed && (
              <Button
                variant="destructive"
                size="lg"
                className="min-h-14 w-full rounded-xl text-lg font-semibold"
                type="button"
                onClick={() => router.push(`${jobHref}#dispute`)}
              >
                View Dispute
              </Button>
            )}
            <Button asChild size="lg" className="min-h-14 w-full rounded-xl text-lg font-semibold shadow-md">
              <Link href={jobHref} className="flex items-center justify-center gap-2">
                <Eye className="h-6 w-6 shrink-0" aria-hidden />
                View job
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="min-h-14 w-full rounded-xl text-lg font-semibold dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              <Link href={`/messages?job=${job.id}`} className="flex items-center justify-center gap-2">
                <MessageCircle className="h-6 w-6 shrink-0" aria-hidden />
                Message lister
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="group relative hidden flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition-all duration-200 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 md:flex [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-xl active:scale-[0.98]">
      <Link
        href={jobHref}
        className="flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg rounded-b-none"
        aria-label={`View job: ${title}`}
      >
        <div className="relative aspect-[16/10] w-full shrink-0 bg-muted dark:bg-gray-800">
          {thumb ? (
            <Image
              src={thumb}
              alt={listing?.title ? `Photo for ${listing.title}` : "Job photo"}
              fill
              quality={75}
              className="object-cover transition-all duration-200 [@media(hover:hover)]:group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
              placeholder="blur"
              blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400" aria-hidden>
              <Briefcase className="h-10 w-10" />
            </div>
          )}
          {/* Faded overlay + "View more photos/info" — hover (desktop) / always subtle on touch */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 [@media(hover:hover)]:group-hover:bg-black/50 [@media(hover:none)]:bg-black/30">
            <span className="text-center text-sm font-medium text-white opacity-0 drop-shadow-md transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:text-xs [@media(hover:none)]:px-2">
              View more photos/info
            </span>
          </div>
          {/* Ellipsis menu — stop propagation so clicking it doesn't navigate */}
          <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground dark:bg-gray-900/80 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  aria-label="Open job actions menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem asChild>
                  <Link href={jobHref} className="flex cursor-pointer items-center gap-2">
                    <Eye className="h-4 w-4" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/messages?job=${job.id}`} className="flex cursor-pointer items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Message Lister
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile#support" className="flex cursor-pointer items-center gap-2">
                    <Flag className="h-4 w-4" />
                    Report Issue
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleShare} className="flex cursor-pointer items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Share Listing
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <p className="line-clamp-2 text-base font-bold text-foreground dark:text-gray-100">{title}</p>
          {listing && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground dark:text-gray-400">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {formatLocationWithState(listing.suburb, listing.postcode)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {listing && (
              <>
                <span className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatCents(listing.current_lowest_bid_cents ?? 0)}
                </span>
                <span className="max-w-[14rem] text-xs leading-snug text-muted-foreground dark:text-gray-500">
                  Price includes 12% platform fee paid by the lister
                </span>
              </>
            )}
            {dueLine != null && (
              <span
                className={cn(
                  overdue ? "font-semibold text-destructive dark:text-red-400" : "text-muted-foreground dark:text-gray-400"
                )}
              >
                {dueLine}
              </span>
            )}
            {(job.status === "disputed" || job.status === "in_review" || job.status === "dispute_negotiating") && (
              <Badge
                variant="destructive"
                aria-label="Disputed"
                className="text-[10px] bg-red-600 text-white dark:bg-red-700 dark:text-red-100"
              >
                Disputed
              </Badge>
            )}
            {(job.status === "accepted" || job.status === "in_progress") && (
              <Badge
                variant={job.status === "in_progress" ? "default" : "secondary"}
                aria-label={job.status === "in_progress" ? "In progress" : "Awaiting approval"}
                className={cn(
                  "text-[10px]",
                  job.status === "in_progress"
                    ? "bg-emerald-600 text-white dark:bg-emerald-950 dark:text-emerald-100"
                    : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800"
                )}
              >
                {job.status === "in_progress" ? "In progress" : "Awaiting approval"}
              </Badge>
            )}
            {job.status === "completed" && (
              <Badge variant="secondary" className="text-[10px]">
                Completed
              </Badge>
            )}
          </div>
          {isDisputed ? (
            <div className="mt-auto flex flex-col gap-1.5">
              <Button
                variant="destructive"
                size="sm"
                className="h-8 w-full text-xs font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(`${jobHref}#dispute`);
                }}
              >
                View Dispute
              </Button>
              <span className="inline-flex h-8 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium ring-offset-background transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
                View Job
              </span>
            </div>
          ) : (
            <span className="mt-auto inline-flex h-8 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium ring-offset-background transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
              View Job
            </span>
          )}
        </div>
      </Link>
    </div>
    </>
  );
}
