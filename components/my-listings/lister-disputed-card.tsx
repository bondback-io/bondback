"use client";

import Link from "next/link";
import { MapPin, MessageCircle, Scale, ArrowRightCircle, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCents, getListingCoverUrl } from "@/lib/listings";
import type { ListingRow } from "@/lib/listings";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil } from "lucide-react";
import { formatDisputePhaseLabel, formatDisputeReasonLabel } from "@/lib/my-listings/dispute-labels";

export type DisputedJobInfo = {
  jobId: string | number;
  status: string | null;
  dispute_reason?: string | null;
  dispute_status?: string | null;
  dispute_opened_by?: string | null;
  disputed_at?: string | null;
  cleaner_confirmed_complete?: boolean | null;
  agreed_amount_cents?: number | null;
};

type Props = {
  listing: ListingRow;
  job: DisputedJobInfo;
  addressLine: string;
  amountCents: number;
  onEditPhotos: () => void;
};

export function ListerDisputedCard({
  listing,
  job,
  addressLine,
  amountCents,
  onEditPhotos,
}: Props) {
  const cover = getListingCoverUrl(listing) ?? "/placeholder-listing.png";
  const jobId = job.jobId;
  const jobPageBase = `/jobs/${listing.id}`;
  const disputeHash = `${jobPageBase}#dispute`;
  const releaseHash = `${jobPageBase}#job-approve-release`;
  const messagesHref = `/messages?job=${jobId}`;

  const phase = formatDisputePhaseLabel(job.status, job.dispute_status);
  const reason = formatDisputeReasonLabel(job.dispute_reason);
  const openedBy =
    job.dispute_opened_by === "lister"
      ? "You opened this dispute"
      : job.dispute_opened_by === "cleaner"
        ? "Cleaner opened this dispute"
        : null;

  const canFinalizeRelease =
    job.cleaner_confirmed_complete === true &&
    (job.status === "in_progress" || job.status === "completed_pending_approval");

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/40 to-card shadow-sm ring-1 ring-amber-500/10",
        "dark:border-amber-800/60 dark:from-amber-950/25 dark:to-gray-950 dark:ring-amber-500/15"
      )}
    >
      <div className="flex gap-3 border-b border-amber-200/60 p-3 dark:border-amber-900/50 sm:gap-4 sm:p-4">
        <Link
          href={jobPageBase}
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28"
        >
          <OptimizedImage src={cover} alt="" fill sizes="112px" className="object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={jobPageBase}
                className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground hover:underline sm:text-base"
              >
                {listing.title || "Listing"}
              </Link>
              <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="line-clamp-2">{addressLine}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {listing.bedrooms} bed · {listing.bathrooms} bath
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem className="min-h-11 cursor-pointer text-base" onClick={onEditPhotos}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit photos
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="min-h-11 cursor-pointer text-base">
                  <Link href={jobPageBase}>Open job page</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className="border-amber-300/80 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100">
              Disputed
            </Badge>
            <span className="text-xs font-medium text-amber-900/90 dark:text-amber-200/90">{phase}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="rounded-xl border border-amber-200/70 bg-white/70 px-3 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/80 dark:text-amber-200/80">
            Dispute reason
          </p>
          <p className="mt-1 text-sm font-medium leading-snug text-foreground">{reason}</p>
          {openedBy && (
            <p className="mt-2 text-xs text-muted-foreground dark:text-gray-400">{openedBy}</p>
          )}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2.5 dark:bg-gray-900/50">
          <span className="text-xs font-medium text-muted-foreground">Job amount</span>
          <span className="text-lg font-bold tabular-nums text-foreground">{formatCents(amountCents)}</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              asChild
              className="h-12 w-full rounded-xl text-base font-semibold shadow-sm"
              size="lg"
            >
              <Link href={disputeHash} className="inline-flex items-center justify-center gap-2">
                <Scale className="h-4 w-4 shrink-0" aria-hidden />
                Review dispute
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 w-full rounded-xl border-2 text-base font-semibold"
              size="lg"
            >
              <Link href={disputeHash} className="inline-flex items-center justify-center gap-2">
                <ArrowRightCircle className="h-4 w-4 shrink-0" aria-hidden />
                Respond
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              asChild
              variant="secondary"
              className="h-12 w-full rounded-xl text-base font-semibold"
              size="lg"
            >
              <Link href={messagesHref} className="inline-flex items-center justify-center gap-2">
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                View chat
              </Link>
            </Button>
            {canFinalizeRelease ? (
              <Button
                asChild
                variant="default"
                className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold hover:bg-emerald-700 dark:bg-emerald-600"
                size="lg"
              >
                <Link href={releaseHash} className="inline-flex items-center justify-center gap-2">
                  <Banknote className="h-4 w-4 shrink-0" aria-hidden />
                  Finalize &amp; release funds
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                className="h-12 w-full rounded-xl text-base font-semibold"
                size="lg"
              >
                <Link href={jobPageBase}>Open full job</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
