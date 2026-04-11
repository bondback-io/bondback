"use client";

import { memo } from "react";
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
  Bookmark,
} from "lucide-react";
import { VerificationBadges } from "@/components/shared/verification-badges";
import { JobCardMarketplaceMobile, formatAuctionTimeLeftShort } from "@/components/JobCard";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { useDistanceUnit } from "@/hooks/use-distance-unit";
import { formatDistanceKmLabel } from "@/lib/distance-format";
import { NEXT_IMAGE_SIZES_LISTING_CARD_DESKTOP } from "@/lib/next-image-sizes";
import { hrefListingOrJob } from "@/lib/navigation/listing-or-job-href";

export type ListingCardProps = {
  listing: ListingRow;
  /** When set, detail links use `hrefListingOrJob` (assigned job → `/jobs/[id]`, else listing). */
  job?: {
    id: number;
    winner_id?: string | null;
    cleaner_id?: string | null;
    status?: string | null;
  } | null;
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
  /** Tighter mobile marketplace row (e.g. /jobs list on small screens). */
  compactMobileMarketplace?: boolean;
};

function getStatus(listing: ListingRow): "live" | "ending_soon" | "expired" {
  if (String(listing.status ?? "").toLowerCase() === "expired") {
    return "expired";
  }
  const end = parseUtcTimestamp(listing.end_time);
  const now = Date.now();
  if (now >= end) return "expired";
  const hoursLeft = (end - now) / (60 * 60 * 1000);
  if (hoursLeft < 24) return "ending_soon";
  return "live";
}

type OverflowMenuProps = {
  jobHref: string;
  listingId: string;
  isCleaner: boolean;
  hideCleanerCancelledAuctionUi: boolean;
  jobStatus: string | null;
  isListerOwner: boolean;
  showListerActions: boolean;
  isLive: boolean;
  hasAssignedCleaner: boolean;
  handleShare: () => void;
  triggerClassName?: string;
};

function ListingCardOverflowMenu({
  jobHref,
  listingId,
  isCleaner,
  hideCleanerCancelledAuctionUi,
  jobStatus,
  isListerOwner,
  showListerActions,
  isLive,
  hasAssignedCleaner,
  handleShare,
  triggerClassName,
}: OverflowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={
            triggerClassName ??
            "h-10 w-10 shrink-0 rounded-full bg-black/30 text-white/90 hover:bg-black/50 hover:text-white dark:bg-black/40 dark:text-white/90 dark:hover:bg-black/60 md:h-8 md:w-8 min-h-[48px] min-w-[48px] md:min-h-0 md:min-w-0"
          }
          aria-label="Job actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-5 w-5 md:h-4 md:w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
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
                <Link href={`/messages?job=${listingId}`} className="flex cursor-pointer items-center gap-2">
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
                <Link
                  href={`/listings/${listingId}?cancel=1`}
                  className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
                >
                  <XCircle className="h-4 w-4 shrink-0" />
                  Cancel listing
                </Link>
              </DropdownMenuItem>
            )}
            {hasAssignedCleaner && (
              <DropdownMenuItem asChild>
                <Link href={`/messages?job=${listingId}`} className="flex cursor-pointer items-center gap-2">
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  Message Cleaner
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/profile#support" className="flex cursor-pointer items-center gap-2">
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
  );
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
function ListingCardInner({
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
  compactMobileMarketplace = false,
  job = null,
}: ListingCardProps) {
  const distanceUnit = useDistanceUnit();
  const jobHref = hrefListingOrJob(
    { id: listing.id, status: listing.status },
    job ?? undefined
  );

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

  const statusLineMarket =
    status === "live"
      ? `Live · ${formatAuctionTimeLeftShort(endTime)}`
      : status === "ending_soon"
        ? `Ending Soon · ${formatAuctionTimeLeftShort(endTime)}`
        : "Ended";
  const isHotJob = isLive && (endingInUnder24h || highDemand);
  const locationLineFull =
    `${formatLocationWithState(listing.suburb, listing.postcode)}` +
    (distanceKm != null && !Number.isNaN(distanceKm)
      ? ` · ${formatDistanceKmLabel(distanceKm, distanceUnit)}`
      : "");

  const overflowMenuProps: OverflowMenuProps = {
    jobHref,
    listingId: String(listing.id),
    isCleaner,
    hideCleanerCancelledAuctionUi,
    jobStatus: jobStatus ?? null,
    isListerOwner,
    showListerActions,
    isLive,
    hasAssignedCleaner,
    handleShare,
  };

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
      <div className="md:hidden">
        <JobCardMarketplaceMobile
          jobHref={jobHref}
          listingId={String(listing.id)}
          title={title}
          thumb={thumb}
          thumbAlt={thumbAlt}
          priceDisplay={formatCents(listing.current_lowest_bid_cents ?? 0)}
          priceLabel={hasBuyNow && isLive ? "Fixed price" : "Current lowest bid"}
          statusLine={statusLineMarket}
          statusVariant={status}
          locationLine={locationLineFull}
          beds={listing.bedrooms as number | undefined}
          baths={listing.bathrooms as number | undefined}
          isHot={isHotJob}
          listerVerificationBadges={effectiveListerBadges}
          showListerTrust={showListerBlock && effectiveListerBadges.length > 0}
          menu={
            <ListingCardOverflowMenu
              {...overflowMenuProps}
              triggerClassName="h-11 w-11 shrink-0 rounded-full bg-black/40 text-white/95 shadow-md hover:bg-black/55 hover:text-white dark:bg-black/50 dark:hover:bg-black/65"
            />
          }
          priority={priority}
          isLive={isLive}
          showCleanerMobileActions={showCleanerMobileActions}
          showPlaceBid={showPlaceBid}
          hasBuyNow={hasBuyNow}
          buyNowCents={typeof listing.buy_now_cents === "number" ? listing.buy_now_cents : null}
          isListerOwner={isListerOwner}
          showListerActions={showListerActions}
          hasAssignedCleaner={hasAssignedCleaner}
          hideCleanerCancelledAuctionUi={hideCleanerCancelledAuctionUi}
          layout={compactMobileMarketplace ? "compact" : "default"}
        />
      </div>

      <div className="hidden md:flex md:flex-col">
      {/* 1. Thumbnail — desktop aspect 4:3 */}
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
              sizes={NEXT_IMAGE_SIZES_LISTING_CARD_DESKTOP}
              quality={75}
              className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              priority={priority}
              placeholder="blur"
              blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
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

        {/* Status badge + menu — over image (desktop) */}
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
          <ListingCardOverflowMenu {...overflowMenuProps} />
        </div>
      </div>

      {/* 2. Main info + Price + CTA — larger padding on mobile for touch */}
      <CardContent
        className={cn(
          "flex flex-1 flex-col gap-4 p-6 dark:bg-gray-900 dark:border-t dark:border-gray-800 md:gap-3",
          isCleaner ? "md:gap-4 md:p-5" : "md:p-4"
        )}
      >
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
            <h3
              className={cn(
                "line-clamp-2 flex-1 text-xl font-bold leading-snug tracking-tight text-foreground dark:text-gray-100 md:leading-tight",
                isCleaner ? "md:text-lg md:font-bold" : "md:text-base md:font-semibold"
              )}
            >
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
          <p
            className={cn(
              "flex items-center gap-2 text-base text-muted-foreground dark:text-gray-400 md:gap-1.5",
              isCleaner ? "md:text-base" : "md:text-sm"
            )}
          >
            <MapPin className={cn("shrink-0", isCleaner ? "h-5 w-5 md:h-4 md:w-4" : "h-5 w-5 md:h-3.5 md:w-3.5")} aria-hidden />
            <span>
              {formatLocationWithState(listing.suburb, listing.postcode)}
              {distanceKm != null && !Number.isNaN(distanceKm) && (
                <span className="ml-1 text-foreground/80 dark:text-gray-300">
                  · {formatDistanceKmLabel(distanceKm, distanceUnit)}
                </span>
              )}
            </span>
          </p>
        </div>

        {/* Quick stats: Beds | Baths | Price range */}
        <p
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-0 text-sm text-muted-foreground dark:text-gray-400",
            isCleaner && "md:text-base"
          )}
          aria-label={`${listing.bedrooms ?? "—"} beds, ${listing.bathrooms ?? "—"} baths, price ${priceRangeLabel}`}
        >
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

        {/* Lister trust row (non-owner): name + verification badges — desktop */}
        {showListerBlock && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground dark:text-gray-400">Property lister:</span>
            <span className="font-medium text-foreground dark:text-gray-100">{listerName}</span>
            <VerificationBadges badges={effectiveListerBadges} showLabel={false} size="sm" />
          </div>
        )}

        {/* Cleaner block (when job assigned) — desktop */}
        {showCleanerBlock && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
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

        {/* Price & urgency row */}
        <div
          className={cn(
            "flex flex-wrap items-end justify-between gap-3",
            isCleaner &&
              "rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 dark:border-emerald-800/40 dark:bg-emerald-950/30"
          )}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              {hasBuyNow && isLive ? "Fixed price" : "Current lowest bid"}
            </p>
            <p
              className={cn(
                "font-bold tabular-nums",
                isCleaner ? "text-3xl md:text-2xl" : "text-2xl md:text-xl md:font-bold",
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
                className="text-sm font-semibold tabular-nums"
              />
            </div>
          )}
        </div>

        {/* Bid count — desktop */}
        <div className="flex items-center gap-2">
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

        {/* Primary CTAs — desktop */}
        <div className="mt-auto flex flex-col gap-2 pt-1">
          <div className="flex flex-col gap-2">
            {isCleaner && isLive && hasBuyNow && !hideCleanerCancelledAuctionUi && (
              <BuyNowButton
                listingId={listing.id}
                buyNowCents={listing.buy_now_cents as number}
                disabled={!isLive}
              />
            )}
            {showPlaceBid && isLive && !hideCleanerCancelledAuctionUi ? (
              <Button
                asChild
                className={cn(
                  "w-full rounded-xl font-semibold transition-transform active:scale-[0.98]",
                  isCleaner ? "min-h-12 text-base md:min-h-12" : "min-h-10 rounded-lg md:min-h-10"
                )}
                size="default"
              >
                <Link
                  href={jobHref}
                  className={cn(
                    "flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isCleaner ? "min-h-12" : "min-h-10"
                  )}
                  aria-label={`Bid on ${title}`}
                >
                  Bid now
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                className={cn(
                  "w-full rounded-xl transition-transform active:scale-[0.98] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
                  isCleaner ? "min-h-12 text-base font-semibold md:min-h-12" : "min-h-10 rounded-lg md:min-h-10"
                )}
                size="default"
              >
                <Link
                  href={jobHref}
                  className={cn(
                    "flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isCleaner ? "min-h-12" : "min-h-10"
                  )}
                  aria-label={`View details for ${title}`}
                >
                  View details
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
      </div>
    </Card>
    </TooltipProvider>
  );
}

export const ListingCard = memo(ListingCardInner);
ListingCard.displayName = "ListingCard";
