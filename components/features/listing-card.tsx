"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CountdownTimer } from "@/components/features/countdown-timer";
import { BuyNowButton } from "@/components/features/buy-now-button";
import { formatCents, getListingCoverUrl } from "@/lib/listings";
import type { ListingRow } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { cn, parseUtcTimestamp } from "@/lib/utils";
import {
  Bed,
  Bath,
  Home,
  MapPin,
  Gavel,
  Star,
  MoreVertical,
  Eye,
  MessageCircle,
  Pencil,
  Flag,
  Share2,
  XCircle,
  CheckCircle2,
  Images,
  ChevronDown,
  ChevronUp,
  Bookmark,
} from "lucide-react";
import { VerificationBadges } from "@/components/shared/verification-badges";

export type ListingCardProps = {
  listing: ListingRow;
  showPlaceBid?: boolean;
  isCleaner?: boolean;
  isListerOwner?: boolean;
  showListerActions?: boolean;
  bidCount?: number;
  distanceKm?: number;
  priority?: boolean;
  /** When job is assigned: cleaner display name */
  cleanerName?: string | null;
  /** When job is assigned: cleaner average rating (e.g. 4.8) */
  cleanerRating?: number | null;
  /** When job is assigned: number of reviews */
  cleanerReviewCount?: number | null;
  /** When true, show "Verified ABN" badge next to cleaner name */
  cleanerVerifiedAbn?: boolean;
  cleanerVerificationBadges?: string[] | null;
  /** When browsing as cleaner (or non-owner): lister display name + trust badges */
  listerName?: string | null;
  listerVerificationBadges?: string[] | null;
  /** When set, used for context menu: e.g. "Mark Complete" when in_progress */
  jobStatus?: string | null;
  /** When true (lister view), show "Message Cleaner" in menu */
  hasAssignedCleaner?: boolean;
};

function getStatus(listing: ListingRow): "live" | "ending_soon" | "expired" {
  const end = parseUtcTimestamp(listing.end_time);
  const now = Date.now();
  if (now >= end) return "expired";
  const hoursLeft = (end - now) / (60 * 60 * 1000);
  if (hoursLeft < 24) return "ending_soon";
  return "live";
}

/**
 * Listing/Job card with trust signals, urgency badges, quick stats, and hover/tap polish.
 * - Rating stars (gold / dark:text-yellow-400) + review count when cleaner assigned
 * - Verified ABN badge (green / dark:bg-green-950) on cleaner name
 * - Photos Available icon when listing has cover/initial photos
 * - Urgency: red "Ending in <24h", purple "High Demand" (>5 bids), gray "No Bids Yet"
 * - Quick stats: "Beds: 3 | Baths: 2 | $350–$420"
 * - Hover: scale 1.02, shadow-xl, ring-primary/20; tap: active:scale-[0.98]
 *
 * Mobile (<768px): fixed thumbnail height 200px (4:3), min 48px touch targets, tap-to-expand
 * for bid count + rating; next/image sizes="(max-width: 768px) 100vw, 50vw". Desktop unchanged.
 *
 * Example snippets:
 *   Rating stars: <span className="text-amber-600 dark:text-yellow-400"><Star className="h-3.5 w-3.5 fill-current" /> {rating}</span>
 *   Urgency: <Badge className="...">Ending in &lt;24h</Badge> | <Badge className="bg-violet-100...">High Demand</Badge> | <Badge variant="secondary">No Bids Yet</Badge>
 *   Hover: "[@media(hover:hover)]:hover:scale-[1.02] [@media(hover:hover)]:hover:shadow-xl [@media(hover:hover)]:hover:ring-2 [@media(hover:hover)]:hover:ring-primary/20"
 *
 * Example mobile card (thumbnail + next/image):
 *   <div className="h-[200px] w-full sm:aspect-[4/3] sm:h-auto">
 *     <Image src={thumb} alt="..." fill sizes="(max-width: 768px) 100vw, 50vw" loading="lazy" className="object-cover" />
 *   </div>
 *   <h3 className="line-clamp-2 ...">{title}</h3>
 *   <Button className="min-h-[48px] ...">Bid now</Button>
 *
 * Quick-action ellipsis (top-right): DropdownMenu with Cleaner / Lister / Common items.
 * Example dropdown items:
 *   <DropdownMenuItem asChild><Link href={jobHref} className="flex items-center gap-2"><Eye className="h-4 w-4" />View Details</Link></DropdownMenuItem>
 *   <DropdownMenuItem asChild><Link href={`/messages?job=${id}`} className="flex items-center gap-2"><MessageCircle className="h-4 w-4" />Message Lister</Link></DropdownMenuItem>
 *   {jobStatus === "in_progress" && <DropdownMenuItem asChild><Link href={`${jobHref}?complete=1`}><CheckCircle2 />Mark Complete</Link></DropdownMenuItem>}
 *   <DropdownMenuItem asChild><Link href="..."><Bookmark />Save Job</Link></DropdownMenuItem>
 *   (Lister: View Bids, Edit Listing, Cancel Job, Message Cleaner)
 *   (Common: Report Issue, Share Listing)
 */
export function ListingCard({
  listing,
  showPlaceBid = true,
  isCleaner = false,
  isListerOwner = false,
  showListerActions = true,
  bidCount,
  distanceKm,
  priority = false,
  cleanerName = null,
  cleanerRating = null,
  cleanerReviewCount = null,
  cleanerVerifiedAbn = false,
  cleanerVerificationBadges = null,
  listerName = null,
  listerVerificationBadges = null,
  jobStatus = null,
  hasAssignedCleaner = false,
}: ListingCardProps) {
  const jobHref = `/jobs/${listing.id}`;

  const handleShare = () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}${jobHref}` : jobHref;
    if (navigator.share) {
      navigator.share({ title: listing.title ?? "Bond clean", url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {});
    }
  };

  const isLive = listing.status === "live" && parseUtcTimestamp(listing.end_time) > Date.now();
  const isListingCancelled = String(listing.status).toLowerCase() === "cancelled";
  const isJobCancelled = String(jobStatus ?? "").toLowerCase() === "cancelled";
  const hideCleanerCancelledAuctionUi =
    isCleaner && (isListingCancelled || isJobCancelled);
  const hasBuyNow =
    typeof listing.buy_now_cents === "number" &&
    listing.buy_now_cents > 0 &&
    (listing.current_lowest_bid_cents ?? 0) >= listing.buy_now_cents;
  const thumb = getListingCoverUrl(listing);
  const status = getStatus(listing);
  const hasBids =
    (typeof bidCount === "number" && bidCount > 0) ||
    (typeof listing.current_lowest_bid_cents === "number" &&
      listing.starting_price_cents != null &&
      listing.current_lowest_bid_cents >= listing.starting_price_cents);
  const isLowPrice =
    typeof listing.buy_now_cents === "number" &&
    listing.buy_now_cents > 0 &&
    (listing.current_lowest_bid_cents ?? 0) <= (listing.buy_now_cents * 0.9);

  const title = listing.title ?? "Bond clean";
  const thumbAlt = title ? `Photo for ${title}` : "Listing photo";
  const propertyType = listing.property_type ? String(listing.property_type) : null;

  const endTime = parseUtcTimestamp(listing.end_time);
  const hoursLeft = (endTime - Date.now()) / (60 * 60 * 1000);
  const endingInUnder24h = isLive && hoursLeft > 0 && hoursLeft < 24;
  const highDemand = typeof bidCount === "number" && bidCount > 5;
  const noBidsYet = (typeof bidCount === "number" && bidCount === 0) || (!hasBids && (bidCount === undefined || bidCount === 0));

  const hasPhotos = Boolean(thumb);

  const currentCents = listing.current_lowest_bid_cents ?? listing.starting_price_cents ?? 0;
  const buyNowCents = typeof listing.buy_now_cents === "number" ? listing.buy_now_cents : null;
  const priceRangeLabel = buyNowCents != null && buyNowCents !== currentCents
    ? `${formatCents(currentCents)}–${formatCents(buyNowCents)}`
    : formatCents(currentCents);

  const showCleanerBlock = cleanerName != null && (cleanerName !== "" || cleanerRating != null);
  const showListerBlock =
    !isListerOwner &&
    typeof listerName === "string" &&
    listerName.trim() !== "";
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const hasSecondary =
    typeof bidCount === "number" || showCleanerBlock || showListerBlock;
  const effectiveCleanerBadges =
    cleanerVerificationBadges && cleanerVerificationBadges.length > 0
      ? cleanerVerificationBadges
      : cleanerVerifiedAbn
        ? (["abn_verified"] as string[])
        : [];
  const effectiveListerBadges =
    listerVerificationBadges && listerVerificationBadges.length > 0
      ? listerVerificationBadges
      : [];

  const showCleanerMobileActions =
    isCleaner &&
    !isListerOwner &&
    isLive &&
    !hideCleanerCancelledAuctionUi;

  return (
    <TooltipProvider delayDuration={300}>
      <Card
        className={cn(
          "group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md transition-all duration-200",
          "dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800",
          "[@media(hover:hover)]:hover:scale-[1.02] [@media(hover:hover)]:hover:shadow-xl [@media(hover:hover)]:hover:ring-2 [@media(hover:hover)]:hover:ring-primary/20 [@media(hover:hover)]:hover:border-primary/30",
          "job-card-tap active:scale-[0.95] md:active:scale-[0.99]",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:outline-none"
        )}
        role="article"
        aria-label={title}
      >
      {/* 1. Thumbnail — mobile full-width, 200px tall; desktop aspect 4:3 */}
      <div className="relative h-[200px] w-full overflow-hidden bg-muted dark:bg-gray-800 md:aspect-[4/3] md:h-auto">
        <Link
          href={jobHref}
          className="absolute inset-0 z-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:scale-[0.98] transition-transform min-h-[48px] min-w-[48px]"
          aria-label={`View listing: ${title}`}
        >
          {thumb ? (
            <Image
              src={thumb}
              alt={thumbAlt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              quality={75}
              className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              loading={priority ? "eager" : "lazy"}
              priority={priority}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400" aria-hidden>
              <Avatar className="h-16 w-16 rounded-xl">
                <AvatarFallback className="rounded-xl bg-muted/80 dark:bg-gray-700" aria-hidden>
                  <Home className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40 [@media(hover:none)]:bg-black/20" aria-hidden />
        </Link>

        {/* Status badge + menu — over image */}
        <div className="absolute left-3 top-3 right-3 z-10 flex items-start justify-between gap-2">
          <Badge
            variant="secondary"
            aria-label={status === "live" ? "Live" : status === "ending_soon" ? "Ending soon" : "Expired"}
            className={cn(
              "px-2.5 py-1 text-xs font-bold uppercase tracking-wide shadow-sm md:px-2 md:py-0.5 md:text-[10px] md:font-semibold",
              status === "live" &&
                "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
              status === "ending_soon" &&
                "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
              status === "expired" &&
                "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            {status === "live" && "Live"}
            {status === "ending_soon" && "Ending soon"}
            {status === "expired" && "Expired"}
          </Badge>
          {/* Quick-action ellipsis — keeps card clean; all secondary actions in dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full bg-black/30 text-white/90 hover:bg-black/50 hover:text-white dark:bg-black/40 dark:text-white/90 dark:hover:bg-black/60 md:h-8 md:w-8 min-h-[48px] min-w-[48px] md:min-h-0 md:min-w-0"
                aria-label="Job actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-5 w-5 md:h-4 md:w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
              {/* Cleaner view */}
              {isCleaner && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={jobHref} className="flex cursor-pointer items-center gap-2">
                      <Eye className="h-4 w-4 shrink-0" />
                      View Details
                    </Link>
                  </DropdownMenuItem>
                  {!hideCleanerCancelledAuctionUi && (
                  <DropdownMenuItem asChild>
                    <Link href={`/messages?job=${listing.id}`} className="flex cursor-pointer items-center gap-2">
                      <MessageCircle className="h-4 w-4 shrink-0" />
                      Message Lister
                    </Link>
                  </DropdownMenuItem>
                  )}
                  {jobStatus === "in_progress" && (
                    <DropdownMenuItem asChild>
                      <Link href={`${jobHref}?complete=1`} className="flex cursor-pointer items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Mark Complete
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={`${jobHref}#save`} className="flex cursor-pointer items-center gap-2">
                      <Bookmark className="h-4 w-4 shrink-0" />
                      Save Job
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {/* Lister view */}
              {isListerOwner && showListerActions && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={jobHref} className="flex cursor-pointer items-center gap-2">
                      <Gavel className="h-4 w-4 shrink-0" />
                      View Bids
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={jobHref} className="flex cursor-pointer items-center gap-2">
                      <Pencil className="h-4 w-4 shrink-0" />
                      Edit Listing
                    </Link>
                  </DropdownMenuItem>
                  {isLive && (
                    <DropdownMenuItem asChild>
                      <Link href={`/jobs/${listing.id}?cancel=1`} className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive">
                        <XCircle className="h-4 w-4 shrink-0" />
                        Cancel Job
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {hasAssignedCleaner && (
                    <DropdownMenuItem asChild>
                      <Link href={`/messages?job=${listing.id}`} className="flex cursor-pointer items-center gap-2">
                        <MessageCircle className="h-4 w-4 shrink-0" />
                        Message Cleaner
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              {/* Common */}
              <DropdownMenuItem asChild>
                <Link href="/settings#support" className="flex cursor-pointer items-center gap-2">
                  <Flag className="h-4 w-4 shrink-0" />
                  Report Issue
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleShare()} className="flex cursor-pointer items-center gap-2">
                <Share2 className="h-4 w-4 shrink-0" />
                Share Listing
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2. Main info + Price + CTA — larger padding on mobile for touch */}
      <CardContent className="flex flex-1 flex-col gap-4 p-6 dark:bg-gray-900 dark:border-t dark:border-gray-800 md:gap-3 md:p-4">
        {/* Urgency badges — compact row */}
        {(endingInUnder24h || highDemand || (noBidsYet && isLive)) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {endingInUnder24h && (
              <Badge className="border-red-200 bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200 md:text-[10px] md:font-semibold" aria-label="Ending in under 24 hours">
                Ending in &lt;24h
              </Badge>
            )}
            {highDemand && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="border-violet-200 bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200 md:text-[10px] md:font-semibold" aria-label="High demand – many cleaners interested">
                    High Demand
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Many cleaners are interested in this job</TooltipContent>
              </Tooltip>
            )}
            {noBidsYet && isLive && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="border-gray-200 px-2 py-0.5 text-xs font-semibold text-muted-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 md:text-[10px] md:font-medium" aria-label="No bids yet">
                    No Bids Yet
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Be the first to place a bid</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* Title + location + Photos badge */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <h3 className="line-clamp-2 flex-1 text-xl font-bold leading-snug tracking-tight text-foreground dark:text-gray-100 md:text-base md:font-semibold md:leading-tight">
              {title}
            </h3>
            {hasPhotos && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="shrink-0 rounded p-0.5 text-muted-foreground dark:text-gray-400" aria-label="Photos available">
                    <Images className="h-5 w-5 md:h-4 md:w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Photos available</TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="flex items-center gap-2 text-base text-muted-foreground dark:text-gray-400 md:gap-1.5 md:text-sm">
            <MapPin className="h-5 w-5 shrink-0 md:h-3.5 md:w-3.5" aria-hidden />
            <span>
              {formatLocationWithState(listing.suburb, listing.postcode)}
              {distanceKm != null && !Number.isNaN(distanceKm) && (
                <span className="ml-1 text-foreground/80 dark:text-gray-300">· ~{Math.round(distanceKm)} km</span>
              )}
            </span>
          </p>
        </div>

        {/* Quick stats: Beds | Baths | Price range */}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0 text-sm text-muted-foreground dark:text-gray-400" aria-label={`${listing.bedrooms ?? "—"} beds, ${listing.bathrooms ?? "—"} baths, price ${priceRangeLabel}`}>
          <span>Beds: {listing.bedrooms ?? "—"}</span>
          <span aria-hidden>|</span>
          <span>Baths: {listing.bathrooms ?? "—"}</span>
          <span aria-hidden>|</span>
          <span className="font-medium text-foreground dark:text-gray-200">{priceRangeLabel}</span>
          {propertyType && (
            <>
              <span aria-hidden>|</span>
              <Badge variant="secondary" className="text-[10px] font-medium dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                {propertyType}
              </Badge>
            </>
          )}
        </p>

        {/* Mobile: condensed secondary (badges) + tap-to-expand for full bid count + cleaner */}
        {hasSecondary && (
          <div className="flex flex-wrap items-center gap-2 md:hidden">
            {typeof bidCount === "number" && (
              <Badge variant="secondary" className="gap-1 text-[10px] font-medium dark:bg-gray-800 dark:text-gray-200">
                <Gavel className="h-3 w-3 shrink-0" aria-hidden />
                {bidCount}
              </Badge>
            )}
            {showCleanerBlock && (cleanerRating != null || (cleanerReviewCount != null && Number(cleanerReviewCount) > 0)) && (
              <Badge variant="secondary" className="gap-1 text-[10px] font-medium text-amber-700 dark:bg-amber-900/50 dark:text-yellow-300">
                <Star className="h-3 w-3 shrink-0 fill-current" aria-hidden />
                {cleanerRating != null ? Number(cleanerRating).toFixed(1) : "—"}
              </Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[48px] min-w-[48px] shrink-0 px-2 text-xs text-muted-foreground md:min-h-0 md:min-w-0"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMobileExpanded((v) => !v); }}
              aria-expanded={mobileExpanded}
              aria-label={mobileExpanded ? "Show less" : "Show more details"}
            >
              {mobileExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="sr-only">{mobileExpanded ? "Less" : "More"}</span>
            </Button>
          </div>
        )}

        {/* Lister trust row (non-owner): name + verification badges */}
        {showListerBlock && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 text-sm",
              hasSecondary && "hidden md:flex"
            )}
          >
            <span className="text-muted-foreground dark:text-gray-400">Property lister:</span>
            <span className="font-medium text-foreground dark:text-gray-100">{listerName}</span>
            <VerificationBadges badges={effectiveListerBadges} showLabel={false} size="sm" />
          </div>
        )}
        {showListerBlock && hasSecondary && mobileExpanded && (
          <div className="flex flex-wrap items-center gap-2 text-sm md:hidden">
            <span className="text-muted-foreground dark:text-gray-400">Property lister:</span>
            <span className="font-medium text-foreground dark:text-gray-100">{listerName}</span>
            <VerificationBadges badges={effectiveListerBadges} showLabel={false} size="sm" />
          </div>
        )}

        {/* Cleaner block (when job assigned): name + Verified ABN, rating stars + review count — hidden on mobile unless expanded */}
        {showCleanerBlock && (
          <div className={cn("flex flex-wrap items-center gap-2 text-sm", hasSecondary && "hidden md:flex")}>
            <span className="font-medium text-foreground dark:text-gray-100">{cleanerName || "Cleaner"}</span>
            <VerificationBadges badges={effectiveCleanerBadges} showLabel={false} size="sm" />
            {(cleanerRating != null || (cleanerReviewCount != null && Number(cleanerReviewCount) > 0)) && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-yellow-400">
                <Star className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden />
                <span className="tabular-nums">{cleanerRating != null ? Number(cleanerRating).toFixed(1) : "—"}</span>
                {cleanerReviewCount != null && Number(cleanerReviewCount) > 0 && (
                  <span className="text-muted-foreground dark:text-gray-400">({Number(cleanerReviewCount)} reviews)</span>
                )}
              </span>
            )}
          </div>
        )}
        {/* Mobile expanded: show full cleaner block */}
        {showCleanerBlock && hasSecondary && mobileExpanded && (
          <div className="flex flex-wrap items-center gap-2 text-sm md:hidden">
            <span className="font-medium text-foreground dark:text-gray-100">{cleanerName || "Cleaner"}</span>
            <VerificationBadges badges={effectiveCleanerBadges} showLabel={false} size="sm" />
            {(cleanerRating != null || (cleanerReviewCount != null && Number(cleanerReviewCount) > 0)) && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-yellow-400">
                <Star className="h-3.5 w-3.5 shrink-0 fill-current" />
                <span className="tabular-nums">{cleanerRating != null ? Number(cleanerRating).toFixed(1) : "—"}</span>
                {cleanerReviewCount != null && Number(cleanerReviewCount) > 0 && (
                  <span className="text-muted-foreground dark:text-gray-400">({Number(cleanerReviewCount)} reviews)</span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Price & urgency row */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              {hasBuyNow && isLive ? "Fixed price" : "Current lowest bid"}
            </p>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums md:text-xl md:font-bold",
                (isLowPrice || hasBuyNow) && isLive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground dark:text-gray-100"
              )}
            >
              {formatCents(listing.current_lowest_bid_cents ?? 0)}
            </p>
          </div>
          {isLive && !hideCleanerCancelledAuctionUi && (
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">Ends in</p>
              <CountdownTimer
                endTime={listing.end_time}
                expiredLabel="Ended"
                className="text-sm font-semibold tabular-nums text-muted-foreground dark:text-gray-400"
                urgentBelowHours={24}
                urgentClassName="text-red-600 font-bold dark:text-red-400"
                warningBelowHours={72}
                warningClassName="text-amber-600 font-semibold dark:text-amber-400"
              />
            </div>
          )}
        </div>

        {/* Bid count badge — hidden on mobile when condensed (tap More to expand) */}
        <div className={cn("flex items-center gap-2", hasSecondary && "hidden md:flex")}>
          {typeof bidCount === "number" ? (
            <Badge variant="secondary" className="gap-1.5 text-xs font-medium dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" aria-label={`${bidCount} bid${bidCount !== 1 ? "s" : ""}`}>
              <Gavel className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {bidCount} bid{bidCount !== 1 ? "s" : ""}
            </Badge>
          ) : hasBids ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <Star className="h-4 w-4 shrink-0 fill-current" aria-hidden />
              Bids placed
            </span>
          ) : (
            <span className="text-sm text-muted-foreground dark:text-gray-400">Open for bids</span>
          )}
        </div>
        {hasSecondary && mobileExpanded && (
          <div className="flex items-center gap-2 md:hidden">
            {typeof bidCount === "number" ? (
              <Badge variant="secondary" className="gap-1.5 text-xs font-medium dark:bg-gray-800 dark:text-gray-200" aria-label={`${bidCount} bid${bidCount !== 1 ? "s" : ""}`}>
                <Gavel className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {bidCount} bid{bidCount !== 1 ? "s" : ""}
              </Badge>
            ) : hasBids ? (
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Bids placed</span>
            ) : (
              <span className="text-sm text-muted-foreground dark:text-gray-400">Open for bids</span>
            )}
          </div>
        )}

        {/* Primary CTAs — mobile (<md): stacked full-width; desktop: unchanged compact pattern */}
        <div className="mt-auto flex flex-col gap-2.5 pt-2 md:gap-2 md:pt-1">
          <div className="flex flex-col gap-2.5 md:hidden">
            <Button
              asChild
              size="lg"
              variant="default"
              className="min-h-12 w-full rounded-xl text-base font-semibold shadow-sm transition-transform active:scale-95"
            >
              <Link
                href={jobHref}
                className="flex min-h-12 w-full items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`View details for ${title}`}
              >
                <Eye className="h-5 w-5 shrink-0" aria-hidden />
                View Details
              </Link>
            </Button>

            {showCleanerMobileActions && hasBuyNow && (
              <BuyNowButton
                listingId={listing.id}
                buyNowCents={listing.buy_now_cents as number}
                disabled={!isLive}
                className="min-h-12 w-full rounded-xl text-base font-semibold active:scale-95"
              />
            )}

            {showCleanerMobileActions && showPlaceBid && (
              <Button
                asChild
                size="lg"
                className="min-h-12 w-full rounded-xl border-0 bg-blue-600 text-base font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Link
                  href={jobHref}
                  className="flex min-h-12 w-full items-center justify-center gap-2"
                  aria-label={`Bid on ${title}`}
                >
                  <Gavel className="h-5 w-5 shrink-0" aria-hidden />
                  Bid Now
                </Link>
              </Button>
            )}

            {showCleanerMobileActions && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-12 w-full rounded-xl border-2 border-border bg-background text-base font-semibold active:scale-95 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
              >
                <Link
                  href={`/messages?job=${listing.id}`}
                  className="flex min-h-12 w-full items-center justify-center gap-2"
                  aria-label="Message lister"
                >
                  <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
                  Message Lister
                </Link>
              </Button>
            )}

            {isListerOwner && showListerActions && isLive && (
              <div className="flex flex-col gap-2.5">
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="min-h-12 w-full rounded-xl text-base font-semibold active:scale-95"
                >
                  <Link href={jobHref} className="flex min-h-12 w-full items-center justify-center gap-2">
                    <Gavel className="h-5 w-5 shrink-0" aria-hidden />
                    View Bids
                  </Link>
                </Button>
                {hasAssignedCleaner && (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="min-h-12 w-full rounded-xl text-base font-semibold active:scale-95"
                  >
                    <Link
                      href={`/messages?job=${listing.id}`}
                      className="flex min-h-12 w-full items-center justify-center gap-2"
                    >
                      <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
                      Message Cleaner
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="hidden flex-col gap-2 md:flex">
            {isCleaner && isLive && hasBuyNow && !hideCleanerCancelledAuctionUi && (
              <BuyNowButton
                listingId={listing.id}
                buyNowCents={listing.buy_now_cents as number}
                disabled={!isLive}
              />
            )}
            {showPlaceBid && isLive && !hideCleanerCancelledAuctionUi ? (
              <Button asChild className="min-h-10 w-full rounded-lg transition-transform active:scale-[0.98] md:min-h-10" size="default">
                <Link href={jobHref} className="flex min-h-10 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`Bid on ${title}`}>
                  Bid now
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="min-h-10 w-full rounded-lg transition-transform active:scale-[0.98] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 md:min-h-10" size="default">
                <Link href={jobHref} className="flex min-h-10 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`View details for ${title}`}>
                  View details
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
