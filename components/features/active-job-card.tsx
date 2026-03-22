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
import { formatCents, getListingCoverUrl } from "@/lib/listings";
import type { ListingRow } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  MapPin,
  MoreVertical,
  Eye,
  MessageCircle,
  Flag,
  Share2,
} from "lucide-react";

type JobRow = { id: string; listing_id: string; status: string };

export type ActiveJobCardProps = {
  job: JobRow;
  listing: ListingRow | null;
  daysLeft: number | null;
};

export function ActiveJobCard({ job, listing, daysLeft }: ActiveJobCardProps) {
  const router = useRouter();
  const jobHref = `/jobs/${job.id}`;
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

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition-all duration-200 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-xl active:scale-[0.98]">
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
                  <Link href="/settings#support" className="flex cursor-pointer items-center gap-2">
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
        <div className="flex flex-1 flex-col gap-2 p-3">
          <p className="line-clamp-2 font-semibold text-foreground dark:text-gray-100">{title}</p>
          {listing && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-400">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              {formatLocationWithState(listing.suburb, listing.postcode)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {listing && (
              <>
                <span className="text-base font-bold tabular-nums text-foreground dark:text-gray-100">
                  {formatCents(listing.current_lowest_bid_cents ?? 0)}
                </span>
                <span className="text-[10px] text-muted-foreground dark:text-gray-500">Price includes 12% platform fee paid by the lister</span>
              </>
            )}
            {daysLeft != null && (
              <span className="text-muted-foreground dark:text-gray-400">{daysLeft} days left</span>
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
  );
}
