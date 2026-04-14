"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Briefcase, ExternalLink, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerificationBadges } from "@/components/shared/verification-badges";
import type { BidBidderProfileSummary } from "@/lib/bids/bidder-types";
import { bidderLegalNameFromProfile } from "@/lib/bids/bidder-display";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { cn } from "@/lib/utils";
import { CleanerReviewCountPreview } from "@/components/features/cleaner-review-count-preview";

export type BidderProfilePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: BidBidderProfileSummary | null;
  loading?: boolean;
};

function StarRow({ rating, size = "sm" }: { rating: number; size?: "sm" | "xs" }) {
  const n = Math.min(5, Math.max(1, Math.round(Number(rating)) || 1));
  const cls = size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3";
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            cls,
            s <= n
              ? "fill-amber-400 text-amber-400 dark:fill-amber-500 dark:text-amber-500"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

export function BidderProfilePreviewDialog({
  open,
  onOpenChange,
  profile,
  loading = false,
}: BidderProfilePreviewDialogProps) {
  const titleName = bidderLegalNameFromProfile(profile);
  const loc =
    profile?.suburb?.trim() && profile?.postcode != null
      ? formatLocationWithState(profile.suburb, String(profile.postcode))
      : profile?.suburb?.trim() || null;

  const avg =
    profile?.cleaner_avg_rating != null && !Number.isNaN(Number(profile.cleaner_avg_rating))
      ? Math.round(Number(profile.cleaner_avg_rating) * 10) / 10
      : null;
  const reviewCount =
    profile?.cleaner_total_reviews != null
      ? Math.max(0, Math.round(Number(profile.cleaner_total_reviews)))
      : 0;
  const jobsDone =
    profile?.completed_jobs_count != null ? Math.max(0, profile.completed_jobs_count) : null;
  const recent = profile?.recent_reviews_as_cleaner ?? [];
  const reviewPopoverSnippets = recent.map((r) => ({
    id: String(r.id),
    text: (r.review_text ?? "").trim(),
    author: r.reviewer_display_name,
    createdAt: r.created_at,
    rating: r.overall_rating,
  }));
  const reviewPopoverHint =
    reviewCount > recent.length && recent.length > 0
      ? `Showing ${recent.length} most recent — open full profile for all ${reviewCount}.`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(92vh,720px)] max-w-md overflow-y-auto border-border bg-card p-0 dark:border-gray-800 dark:bg-gray-950 sm:max-w-md",
          "data-[state=open]:duration-300"
        )}
      >
        {loading ? (
          <div className="space-y-4 p-6">
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted dark:bg-gray-800" />
            <div className="h-24 w-24 animate-pulse rounded-full bg-muted dark:bg-gray-800" />
            <div className="h-20 animate-pulse rounded bg-muted dark:bg-gray-800" />
          </div>
        ) : profile ? (
          <>
            <DialogHeader className="space-y-1 border-b border-border px-5 pb-3 pt-5 dark:border-gray-800 sm:px-6">
              <DialogTitle className="text-left text-lg font-semibold tracking-tight dark:text-gray-100 sm:text-xl">
                {titleName}
              </DialogTitle>
              {profile.cleaner_username?.trim() ? (
                <p className="text-sm font-medium text-muted-foreground dark:text-gray-400">
                  @{profile.cleaner_username.trim()}
                </p>
              ) : null}
            </DialogHeader>
            <div className="space-y-4 px-5 pb-5 pt-3 sm:px-6">
              <div className="flex flex-wrap items-start gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-border dark:bg-gray-900 dark:ring-gray-700 sm:h-24 sm:w-24">
                  {profile.profile_photo_url?.trim() ? (
                    <Image
                      src={profile.profile_photo_url.trim()}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="96px"
                      placeholder="blur"
                      blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-muted-foreground dark:text-gray-500">
                      {titleName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {profile.business_name?.trim() ? (
                    <p className="text-xs text-muted-foreground dark:text-gray-400 sm:text-sm">
                      <span className="font-medium text-foreground dark:text-gray-200">Business: </span>
                      {profile.business_name.trim()}
                    </p>
                  ) : null}
                  {loc ? (
                    <p className="text-xs text-muted-foreground dark:text-gray-400 sm:text-sm">
                      <span className="font-medium text-foreground dark:text-gray-200">Area: </span>
                      {loc}
                    </p>
                  ) : null}
                  {typeof profile.years_experience === "number" && profile.years_experience >= 0 ? (
                    <p className="text-xs text-muted-foreground dark:text-gray-400 sm:text-sm">
                      <span className="font-medium text-foreground dark:text-gray-200">Experience: </span>
                      {profile.years_experience} years
                    </p>
                  ) : null}
                  <div className="pt-0.5">
                    <VerificationBadges badges={profile.verification_badges ?? []} size="sm" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/90 bg-muted/25 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/50">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-500">
                  Rating &amp; activity
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {avg != null ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-semibold tabular-nums text-foreground dark:text-gray-100">
                        {avg.toFixed(1)}
                      </span>
                      <StarRow rating={avg} />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground dark:text-gray-400">Not rated yet</span>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground dark:text-gray-400">
                    {reviewCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                        <CleanerReviewCountPreview
                          count={reviewCount}
                          snippets={reviewPopoverSnippets}
                          moreCountHint={reviewPopoverHint}
                        />
                      </span>
                    ) : (
                      <span>0 reviews</span>
                    )}
                    {jobsDone != null && jobsDone > 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Briefcase className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                          {jobsDone} job{jobsDone === 1 ? "" : "s"} done
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {profile.bio?.trim() ? (
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-500">
                    Bio
                  </p>
                  <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-foreground dark:text-gray-200">
                    {profile.bio.trim()}
                  </p>
                </div>
              ) : null}
              {Array.isArray(profile.specialties) && profile.specialties.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-500">
                    Specialties
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {profile.specialties.map((s) => (
                      <Badge key={s} variant="secondary" className="px-2 py-0 text-[10px] font-normal capitalize">
                        {String(s).replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button
                variant="outline"
                className="h-11 w-full gap-2 border-emerald-600/40 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
                asChild
              >
                <Link href={`/cleaners/${profile.id}`}>
                  View full profile
                  <ExternalLink className="h-4 w-4 opacity-80" aria-hidden />
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <p className="p-6 text-sm text-muted-foreground dark:text-gray-400">Could not load profile.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
