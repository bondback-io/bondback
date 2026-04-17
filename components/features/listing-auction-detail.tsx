"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bed,
  Bath,
  MapPin,
  Gavel,
  Briefcase,
  Clock,
  Calendar,
  Images,
  Info,
  Sparkles,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  collectListingPhotoUrls,
  formatCents,
  mergePhotoUrlLists,
  orderCoverPhotoFirst,
  isListingLive,
  type ListingRow,
} from "@/lib/listings";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { cn, parseUtcTimestamp } from "@/lib/utils";
import { PlaceBidForm } from "@/components/features/place-bid-form";
import {
  BidHistoryTable,
  type BidWithBidder,
} from "@/components/features/bid-history-table";
import { requestEarlyBidAcceptance } from "@/lib/actions/early-bid-acceptance";
import { scrollToTopAfterBidAccepted } from "@/lib/deferred-router";
import { resolveAuctionEndForListing } from "@/lib/actions/auction-resolution";
import { cancelLastBid } from "@/lib/actions/bids";
import { useToast } from "@/components/ui/use-toast";
import { showAppErrorToast } from "@/components/errors/show-app-error-toast";
import { logClientError } from "@/lib/errors/log-client-error";
import { CountdownTimer } from "@/components/features/countdown-timer";
import { ListingEndsAtLocal } from "@/components/features/listing-ends-at-local";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { ImageLightboxGallery } from "@/components/ui/image-lightbox-gallery";
import {
  listingPropertyDescriptionBody,
  parseListingCalendarDate,
  formatDateDdMmYyyy,
  humanizePropertyCondition,
  preferredWindowFromMoveOutDate,
  specialInstructionsForDisplay,
} from "@/lib/listing-detail-presenters";
import { ListerEndAuctionControl } from "@/components/listing/lister-end-auction-control";
import { isListerNoBidsRelistListing } from "@/lib/my-listings/lister-listing-helpers";
import { formatListingAddonDisplayName } from "@/lib/listing-addon-prices";
import { isListingAddonSpecialArea } from "@/lib/listing-special-areas";

export type ListingAuctionDetailProps = {
  listing: ListingRow;
  initialBids: BidWithBidder[];
  isCleaner: boolean;
  /** True when the current user owns this listing and has the lister role on their profile. */
  isListerOwner: boolean;
  /** True when the session is in lister mode (active_role). Cancel listing / accept bid require this. */
  isListerSessionActive: boolean;
  /** Job row exists and is not cancelled — auction closed / work assigned */
  hasActiveJob: boolean;
  numericJobId: number | null;
  currentUserId: string | null;
  /** From `jobs.secured_via_buy_now` when a job exists. */
  securedViaBuyNow?: boolean;
  /** Amount to show in Buy Now bid-history banner (listing buy-now or agreed fallback). */
  buyNowHistoryAmountCents?: number | null;
  /** Find Jobs inline panel: hide page-level “Back” link; full width. */
  embedInFindJobs?: boolean;
};

export function ListingAuctionDetail({
  listing,
  initialBids,
  isCleaner,
  isListerOwner,
  isListerSessionActive,
  hasActiveJob,
  numericJobId,
  currentUserId,
  securedViaBuyNow = false,
  buyNowHistoryAmountCents = null,
  embedInFindJobs = false,
}: ListingAuctionDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [photoLightbox, setPhotoLightbox] = useState<{
    urls: string[];
    index: number;
  } | null>(null);
  const [showCancelListingDialog, setShowCancelListingDialog] = useState(false);
  const [cancellingListing, setCancellingListing] = useState(false);
  /** Same source as job detail: list storage so we show every file even if DB arrays are incomplete. */
  const [storageInitialUrls, setStorageInitialUrls] = useState<string[] | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.storage
        .from("condition-photos")
        .list(`listings/${listing.id}/initial`, { limit: 100 });
      if (cancelled) return;
      if (error || !data) {
        setStorageInitialUrls([]);
        return;
      }
      const urls = data
        .filter((f) => f.name && !f.name.startsWith("thumb_"))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => {
          const {
            data: { publicUrl },
          } = supabase.storage
            .from("condition-photos")
            .getPublicUrl(`listings/${listing.id}/initial/${f.name}`);
          return publicUrl;
        });
      setStorageInitialUrls(urls);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [listing.id]);

  const isLive = isListingLive(listing);

  /**
   * Countdown hit zero but DB still has `status: live` and no job row yet — `resolveAuctionEndForListing` is
   * running. Without this, UI briefly shows "Listing ended" / relist copy before refresh shows the job.
   */
  const pendingAutoAssignWinner = useMemo(() => {
    if (hasActiveJob) return false;
    if (isLive) return false;
    if (String(listing.status ?? "").toLowerCase() !== "live") return false;
    return initialBids.some((b) => b.status === "active");
  }, [hasActiveJob, isLive, listing.status, initialBids]);

  /** Winning bid accepted → job row exists even if listing page props briefly miss `hasActiveJob`. */
  const hasAcceptedWinningBid = initialBids.some((b) => b.status === "accepted");
  const jobSnapshotForRelistUi =
    hasActiveJob || hasAcceptedWinningBid ? { status: "accepted" as const } : null;

  /** Expired (no bid rows) or ended (no assignable winner) — same pool as My listings → Listings (no bids). */
  const isRelistPoolBanner =
    !pendingAutoAssignWinner &&
    isListerNoBidsRelistListing(listing, jobSnapshotForRelistUi);
  const closedAuctionBidStatus =
    !isLive && !pendingAutoAssignWinner && !hasAcceptedWinningBid
      ? listing.cancelled_early_at
        ? ("lister_cancelled" as const)
        : ("auction_ended" as const)
      : null;
  const isListingCancelled =
    String(listing.status ?? "").toLowerCase() === "cancelled";
  const showCleanerBidUi =
    isCleaner && isLive && !hasActiveJob && !isListingCancelled;

  const handleAcceptBid = useCallback(
    async (bid: BidWithBidder) => {
      const result = await requestEarlyBidAcceptance(listing.id, bid.id);
      if (result.ok) {
        toast({
          title: "Bid accepted — job created",
          description:
            "Opening the job so you can pay & start when you’re ready.",
        });
        const jid = Number(result.jobId);
        if (Number.isFinite(jid) && jid > 0) {
          router.replace(`/jobs/${jid}`);
        } else {
          router.refresh();
          scrollToTopAfterBidAccepted();
        }
      } else {
        logClientError("earlyBidAccept", result.error, {
          listingId: listing.id,
          bidId: bid.id,
        });
        showAppErrorToast(toast, {
          flow: "earlyAccept",
          error: new Error(result.error ?? ""),
          context: "listingAuction.earlyAccept",
        });
      }
    },
    [listing.id, toast, router]
  );

  const showRevertLastBidInHistory =
    isCleaner &&
    isLive &&
    !hasActiveJob &&
    Boolean(
      currentUserId &&
        initialBids.some(
          (b) =>
            b.cleaner_id === currentUserId && b.status === "active"
        )
    );

  const handleAuctionTimerExpired = useCallback(() => {
    void resolveAuctionEndForListing(listing.id).then(() => {
      router.refresh();
    });
  }, [listing.id, router]);

  const handleRevertLastBid = useCallback(async () => {
    try {
      const result = await cancelLastBid(String(listing.id));
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Could not cancel bid",
          description: result.error,
        });
        return;
      }
      toast({
        title: "Bid removed",
        description: "Your last bid on this listing was withdrawn.",
      });
      router.refresh();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not cancel bid",
        description: e instanceof Error ? e.message : "Something went wrong.",
      });
    }
  }, [listing.id, toast, router]);

  const hasPendingEarlyAcceptance = initialBids.some(
    (b) => b.status === "pending_confirmation"
  );

  const address = formatLocationWithState(
    listing.suburb ?? "",
    listing.postcode ?? ""
  );
  const beds = listing.bedrooms as number | undefined;
  const baths = listing.bathrooms as number | undefined;

  const photoUrls = useMemo(() => {
    const fromDb = collectListingPhotoUrls(listing);
    if (storageInitialUrls == null) {
      return orderCoverPhotoFirst(fromDb, listing.cover_photo_url);
    }
    const merged = mergePhotoUrlLists(storageInitialUrls, fromDb);
    return orderCoverPhotoFirst(merged, listing.cover_photo_url);
  }, [listing, storageInitialUrls]);
  const heroSrc = photoUrls[0] ?? null;

  const propertyType = listing.property_type ? String(listing.property_type) : null;
  const conditionLabel = humanizePropertyCondition(
    (listing as { property_condition?: string | null }).property_condition
  );
  const levelsRaw = (listing as { property_levels?: string | null }).property_levels;
  const levelsLabel =
    levelsRaw != null && String(levelsRaw).trim() !== ""
      ? String(levelsRaw).includes("storey") || String(levelsRaw).includes("level")
        ? String(levelsRaw)
        : `${levelsRaw} storey${String(levelsRaw) === "1" ? "" : "s"}`
      : null;

  const addons = Array.isArray(listing.addons) ? listing.addons.filter(Boolean) : [];

  const startingCents = listing.starting_price_cents ?? 0;
  const currentLowCents = listing.current_lowest_bid_cents ?? 0;
  const buyNowCents =
    typeof listing.buy_now_cents === "number" ? listing.buy_now_cents : null;
  const hasBuyNow = buyNowCents != null && buyNowCents > 0;

  const moveOut = listing.move_out_date?.trim()
    ? listing.move_out_date
    : null;
  const moveOutDate = moveOut ? parseListingCalendarDate(moveOut) : null;
  const moveOutDisplay = moveOutDate ? formatDateDdMmYyyy(moveOutDate) : moveOut;
  /** Listing detail: show preferred window as 5 days before move-out when move-out is known. */
  const preferredWindowFromMoveOut = preferredWindowFromMoveOutDate(moveOutDate);

  const preferredRaw = (listing as { preferred_dates?: string[] | null }).preferred_dates;
  const preferredDates =
    Array.isArray(preferredRaw) && preferredRaw.length > 0
      ? preferredRaw.filter((d) => d && String(d).trim())
      : [];
  const preferredDatesFormatted = preferredDates.map((d) => {
    const dt = parseListingCalendarDate(d);
    return dt ? formatDateDdMmYyyy(dt) : d;
  });

  const showPreferredFromMoveOut = moveOutDate != null && preferredWindowFromMoveOut != null;
  const showPreferredFallbackList =
    !showPreferredFromMoveOut && preferredDatesFormatted.length > 0;

  const canManageListingAsLister = isListerOwner && isListerSessionActive;

  /** Ended auction with no job: strong “closed” visuals — skip when a bid was accepted (job exists). */
  const showEndedListingVisual =
    !isLive && !hasActiveJob && !pendingAutoAssignWinner && !hasAcceptedWinningBid;
  const endedListingBannerLabel = listing.cancelled_early_at
    ? "Listing cancelled"
    : "Listing ended";

  const showListerTopBar =
    canManageListingAsLister && !hasActiveJob && isLive && embedInFindJobs;

  return (
    <div
      className={cn(
        "mx-auto w-full space-y-4 pb-10 max-md:space-y-3 sm:space-y-6",
        embedInFindJobs ? "max-w-none" : "max-w-4xl"
      )}
    >
      {!embedInFindJobs || showListerTopBar ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            embedInFindJobs ? "justify-end" : "justify-between"
          )}
        >
          {!embedInFindJobs && (
            <Button variant="ghost" asChild className="-ml-2 w-fit">
              <Link
                href={
                  canManageListingAsLister ? "/my-listings" : isCleaner ? "/dashboard" : "/jobs"
                }
              >
                ← Back
              </Link>
            </Button>
          )}
          {canManageListingAsLister && !hasActiveJob && isLive && (
            <ListerEndAuctionControl
              onRequestCancel={() => setShowCancelListingDialog(true)}
            />
          )}
        </div>
      ) : null}

      {hasActiveJob && numericJobId != null ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm dark:bg-primary/10">
          <div className="flex flex-wrap items-center gap-2">
            <Briefcase className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-medium">This listing has an active job.</span>
          </div>
          <Button asChild className="mt-3 rounded-xl" size="sm">
            <Link href={`/jobs/${numericJobId}`}>Open job #{numericJobId}</Link>
          </Button>
        </div>
      ) : null}

      {/* Hero + title */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-card shadow-sm dark:bg-gray-950",
          showEndedListingVisual
            ? "border-red-900/50 ring-1 ring-red-500/25 dark:border-red-900/60"
            : "border-border dark:border-gray-800"
        )}
      >
        <div className="relative aspect-[16/10] max-h-[min(52vh,420px)] w-full bg-muted dark:bg-gray-900 md:aspect-[21/9] md:max-h-[380px]">
          {showEndedListingVisual && (
            <div
              className="absolute inset-x-0 top-0 z-20 border-b border-red-900/50 bg-red-600 px-3 py-2.5 text-center shadow-[0_4px_24px_rgba(0,0,0,0.35)] sm:py-3"
              role="status"
            >
              <p className="text-sm font-black uppercase tracking-[0.14em] text-white sm:text-base md:text-lg">
                {endedListingBannerLabel}
              </p>
            </div>
          )}
          {heroSrc ? (
            <Image
              src={heroSrc}
              alt=""
              fill
              priority
              className={cn(
                "object-cover",
                showEndedListingVisual && "opacity-[0.72] saturate-[0.65]"
              )}
              sizes="(max-width: 896px) 100vw, 896px"
              placeholder="blur"
              blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
            />
          ) : (
            <div className="flex h-full min-h-[200px] w-full items-center justify-center text-muted-foreground">
              <Images className="h-16 w-16 opacity-40" aria-hidden />
            </div>
          )}
          {showEndedListingVisual && (
            <div className="absolute inset-0 bg-red-950/25 mix-blend-multiply dark:bg-red-950/35" aria-hidden />
          )}
          {/* Image wash: mobile uses a shorter band so the title strip feels less cramped */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/48 to-transparent sm:via-black/38 md:from-black/75 md:via-black/25 md:to-transparent"
            aria-hidden
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/60 to-transparent max-md:h-[36%] md:hidden"
            aria-hidden
          />
          <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-4 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-2 sm:gap-3 max-md:rounded-xl max-md:border max-md:border-white/12 max-md:bg-black/40 max-md:p-2.5 max-md:shadow-[0_8px_28px_rgba(0,0,0,0.45)] max-md:backdrop-blur-md md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
              <div className="min-w-0 flex-1">
                <h1 className="text-balance text-[1.0625rem] font-bold leading-tight tracking-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_3px_16px_rgba(0,0,0,0.55)] sm:text-xl sm:leading-snug md:text-2xl md:leading-tight lg:text-3xl md:[text-shadow:0_2px_12px_rgba(0,0,0,0.55)]">
                  {listing.title ?? "Bond clean"}
                </h1>
                <p className="mt-0.5 flex items-start gap-1.5 text-xs font-medium text-white/95 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)] sm:mt-1 sm:items-center sm:gap-2 sm:text-sm md:[text-shadow:0_1px_8px_rgba(0,0,0,0.65)]">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0 sm:h-4 sm:w-4" aria-hidden />
                  <span className="min-w-0 leading-snug">{address}</span>
                </p>
              </div>
              {isLive ? (
                <Badge className="shrink-0 border-0 bg-emerald-500/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md [box-shadow:0_2px_10px_rgba(0,0,0,0.4)] sm:px-2.5 sm:py-1.5 sm:text-xs md:text-sm">
                  Live auction
                </Badge>
              ) : pendingAutoAssignWinner ? (
                <Badge className="shrink-0 border-0 bg-sky-600/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md sm:px-2.5 sm:py-1.5 sm:text-xs">
                  Finalising
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className={cn(
                    "shrink-0 font-bold uppercase tracking-wide",
                    showEndedListingVisual &&
                      "border-0 bg-red-950/90 text-white dark:bg-red-950/95"
                  )}
                >
                  Not live
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Live countdown strip */}
        {isLive && (
          <div className="border-t border-border bg-gradient-to-r from-emerald-500/10 via-card to-sky-500/10 px-4 py-4 dark:border-gray-800 dark:from-emerald-950/40 dark:to-sky-950/30 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <Clock className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                    Time left
                  </p>
                  <CountdownTimer
                    endTime={listing.end_time}
                    expiredLabel="Auction ended"
                    className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300 md:text-2xl"
                    urgentBelowHours={24}
                    onExpired={handleAuctionTimerExpired}
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground dark:text-gray-400">
                <span className="font-medium text-foreground dark:text-gray-200">Ends: </span>
                <ListingEndsAtLocal endTime={listing.end_time} />
              </div>
            </div>
          </div>
        )}
      </div>

      {pendingAutoAssignWinner && (
        <div
          className="flex gap-3 rounded-xl border border-sky-500/35 bg-sky-500/[0.08] px-4 py-3 text-sm dark:border-sky-800/50 dark:bg-sky-950/35 dark:text-sky-100"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-sky-600 dark:text-sky-400" aria-hidden />
          <div>
            <p className="font-semibold text-sky-950 dark:text-sky-50">Finalising auction</p>
            <p className="mt-0.5 text-sky-950/85 dark:text-sky-100/90">
              Assigning the winning bid and opening the job — this usually takes a moment.
            </p>
          </div>
        </div>
      )}

      {isRelistPoolBanner && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Auction closed — no hired cleaner</p>
          <p className="mt-1 text-amber-950/90 dark:text-amber-100/90">
            {String(listing.status ?? "").toLowerCase() === "expired" ? (
              <>
                This listing did not receive any bids before the timer ran out. Relist from{" "}
                <Link href="/my-listings?tab=no_bids" className="font-medium underline underline-offset-2">
                  My listings → Listings (no bids)
                </Link>
                .
              </>
            ) : (
              <>
                The auction ended without a confirmed cleaner. Relist from{" "}
                <Link href="/my-listings?tab=no_bids" className="font-medium underline underline-offset-2">
                  My listings → Listings (no bids)
                </Link>
                .
              </>
            )}
          </p>
        </div>
      )}

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-xl leading-tight md:text-2xl">About this listing</CardTitle>
            {isLive ? (
              <Badge className="shrink-0">Live</Badge>
            ) : (
              <Badge
                variant="secondary"
                className="shrink-0 font-semibold uppercase tracking-wide"
              >
                Not live
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {specialInstructionsForDisplay(listing.special_instructions).trim() && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 dark:border-amber-800/40 dark:bg-amber-950/25">
              <h3 className="mb-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
                Special instructions
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-950/90 dark:text-amber-50/95">
                {specialInstructionsForDisplay(listing.special_instructions)}
              </p>
            </div>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Property description</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground dark:text-gray-200">
              {listingPropertyDescriptionBody(listing) || "No property description provided."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing — full-width strip on desktop; stacked on small screens */}
      <Card
        className={cn(
          "overflow-hidden shadow-sm dark:border-gray-800",
          showEndedListingVisual
            ? "border-red-900/50 ring-1 ring-red-500/20 dark:border-red-900/60"
            : "border-border/90"
        )}
      >
        <CardContent className="p-0">
          <div
            className={cn(
              "grid grid-cols-1 divide-y divide-border dark:divide-gray-800",
              "md:divide-y-0 md:divide-x md:divide-border/80",
              hasBuyNow ? "md:grid-cols-3" : "md:grid-cols-2"
            )}
          >
            <div
              className={cn(
                "flex min-h-[5.25rem] flex-col justify-center gap-1 px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6",
                showEndedListingVisual
                  ? "bg-red-950/20 dark:bg-red-950/35"
                  : "bg-emerald-500/[0.06] dark:bg-emerald-950/30"
              )}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                Current lowest bid
              </p>
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
                  showEndedListingVisual
                    ? "text-muted-foreground line-through decoration-red-500/80 decoration-2 dark:text-gray-500"
                    : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {formatCents(currentLowCents)}
              </p>
            </div>
            <div
              className={cn(
                "flex min-h-[5.25rem] flex-col justify-center gap-1 px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6",
                showEndedListingVisual ? "bg-muted/50 dark:bg-red-950/30" : "bg-card dark:bg-gray-950/40"
              )}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                Starting bid
              </p>
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
                  showEndedListingVisual
                    ? "text-muted-foreground line-through decoration-red-500/80 decoration-2 dark:text-gray-500"
                    : "text-foreground dark:text-gray-100"
                )}
              >
                {formatCents(startingCents)}
              </p>
            </div>
            {hasBuyNow && (
              <div
                className={cn(
                  "flex min-h-[5.25rem] flex-col justify-center gap-1 px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6",
                  showEndedListingVisual
                    ? "bg-red-950/15 dark:bg-red-950/40"
                    : "bg-violet-500/[0.07] dark:bg-violet-950/35"
                )}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                  Buy now
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
                    showEndedListingVisual
                      ? "text-muted-foreground line-through decoration-red-500/80 decoration-2 dark:text-gray-500"
                      : "text-violet-700 dark:text-violet-300"
                  )}
                >
                  {formatCents(buyNowCents!)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Property summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 shrink-0" aria-hidden />
            Property
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground dark:text-gray-400">
            {beds != null && (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground dark:text-gray-200">
                <Bed className="h-4 w-4 shrink-0" aria-hidden />
                {beds} bed
              </span>
            )}
            {baths != null && (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground dark:text-gray-200">
                <Bath className="h-4 w-4 shrink-0" aria-hidden />
                {baths} bath
              </span>
            )}
            {propertyType && (
              <Badge variant="secondary" className="capitalize">
                {propertyType.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          {(conditionLabel ||
            levelsLabel ||
            (typeof listing.duration_days === "number" && listing.duration_days > 0)) && (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {conditionLabel && (
                <div className="min-w-0 space-y-1">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                    Condition
                  </dt>
                  <dd className="text-sm leading-snug text-foreground dark:text-gray-100">{conditionLabel}</dd>
                </div>
              )}
              {levelsLabel && (
                <div className="min-w-0 space-y-1">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                    Levels
                  </dt>
                  <dd className="text-sm leading-snug text-foreground dark:text-gray-100">{levelsLabel}</dd>
                </div>
              )}
              {typeof listing.duration_days === "number" && listing.duration_days > 0 && (
                <div className="min-w-0 space-y-1">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                    Auction listing period
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground dark:text-gray-100">
                    {listing.duration_days} days
                  </dd>
                </div>
              )}
            </dl>
          )}
          {addons.length > 0 && (
            <div className="border-t border-border pt-4 dark:border-gray-800">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                Add-ons
              </p>
              <div className="flex flex-wrap gap-2">
                {addons.map((a) => (
                  <Badge
                    key={a}
                    variant="outline"
                    title={
                      isListingAddonSpecialArea(listing, a)
                        ? "Special area (from listing)"
                        : "Paid add-on"
                    }
                    className={cn(
                      "font-normal",
                      isListingAddonSpecialArea(listing, a)
                        ? "border-amber-500/75 bg-amber-500/[0.14] text-amber-950 shadow-sm dark:border-amber-400/55 dark:bg-amber-950/45 dark:text-amber-50"
                        : "capitalize"
                    )}
                  >
                    {isListingAddonSpecialArea(listing, a) ? (
                      <span className="font-semibold tracking-wide">Special area · </span>
                    ) : null}
                    <span className="capitalize">{formatListingAddonDisplayName(a)}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dates */}
      {(moveOut || showPreferredFallbackList) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 shrink-0" aria-hidden />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 text-sm md:grid-cols-2 md:gap-6 lg:gap-8">
              {moveOut && (
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                    Move-out
                  </p>
                  <p className="text-base font-semibold tabular-nums text-foreground dark:text-gray-100">
                    {moveOutDisplay}
                  </p>
                </div>
              )}
              {showPreferredFromMoveOut && (
                <div
                  className={
                    moveOut
                      ? "min-w-0 space-y-2 md:border-l md:border-border md:pl-6 dark:md:border-gray-800"
                      : "min-w-0 space-y-2"
                  }
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                    Preferred cleaning window
                  </p>
                  <p className="text-base font-semibold tabular-nums text-foreground dark:text-gray-100">
                    {preferredWindowFromMoveOut}
                  </p>
                  <p className="text-xs leading-snug text-muted-foreground dark:text-gray-500">
                    Target window starts 5 days before your move-out date.
                  </p>
                </div>
              )}
              {showPreferredFallbackList && (
                <div
                  className={
                    moveOut
                      ? "min-w-0 space-y-2 md:border-l md:border-border md:pl-6 dark:md:border-gray-800"
                      : "min-w-0 space-y-2"
                  }
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                    Preferred cleaning window
                  </p>
                  <ul className="space-y-1.5 text-foreground dark:text-gray-200">
                    {preferredDatesFormatted.map((d, i) => (
                      <li key={`${d}-${i}`} className="flex gap-2 text-sm">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                        <span className="tabular-nums">{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Initial condition photos */}
      {photoUrls.length > 0 && (
        <Card id="listing-photos">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              Initial condition photos
            </CardTitle>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Photos supplied by the lister before the clean — tap to enlarge.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3">
              {photoUrls.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() =>
                    setPhotoLightbox({ urls: [...photoUrls], index: i })
                  }
                  className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted ring-offset-background transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-gray-800"
                >
                  <Image
                    src={url}
                    alt={`Property photo ${i + 1}`}
                    fill
                    className="object-cover transition duration-200 group-hover:scale-[1.02]"
                    sizes="(max-width: 640px) 50vw, 280px"
                    placeholder="blur"
                    blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
                  />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showCancelListingDialog && canManageListingAsLister}
        onOpenChange={(open) => {
          if (!cancellingListing) setShowCancelListingDialog(open);
        }}
      >
        <DialogContent className="max-w-md dark:border-gray-700 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Cancel this listing?</DialogTitle>
            <DialogDescription className="text-left">
              This will end the auction early. No new bids will be accepted, and cleaners who bid will
              see that the listing has ended. The listing stays in your history. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCancelListingDialog(false)}
              disabled={cancellingListing}
            >
              Keep listing live
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancellingListing}
              onClick={async () => {
                setCancellingListing(true);
                try {
                  const { cancelListing } = await import("@/lib/actions/listings");
                  const res = await cancelListing(String(listing.id));
                  if (res.ok) {
                    setShowCancelListingDialog(false);
                    toast({
                      title: "Listing cancelled",
                      description:
                        "The auction has ended early. You can view it under My Listings.",
                    });
                    router.refresh();
                  } else {
                    toast({
                      variant: "destructive",
                      title: "Could not cancel listing",
                      description: res.error,
                    });
                  }
                } finally {
                  setCancellingListing(false);
                }
              }}
            >
              {cancellingListing ? "Cancelling…" : "Yes, end listing early"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageLightboxGallery
        open={photoLightbox != null}
        urls={photoLightbox?.urls ?? []}
        initialIndex={photoLightbox?.index ?? 0}
        onClose={() => setPhotoLightbox(null)}
        ariaLabel="Initial condition photos"
      />

      {showCleanerBidUi && (
        <Card id="place-bid">
          <CardHeader>
            <CardTitle className="text-lg">Place a bid</CardTitle>
          </CardHeader>
          <CardContent>
            <PlaceBidForm
              listingId={listing.id}
              listing={listing}
              isCleaner={isCleaner}
              currentUserId={currentUserId}
            />
          </CardContent>
        </Card>
      )}

      <Card id="bids" className="overflow-hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 [&::-webkit-details-marker]:hidden">
            <Gavel className="h-5 w-5 shrink-0" aria-hidden />
            <CardTitle className="mb-0 flex flex-1 items-center gap-2 text-lg">
              Bids
              {initialBids.length > 0 ? (
                <Badge variant="secondary" className="font-mono text-xs tabular-nums">
                  {initialBids.length}
                </Badge>
              ) : null}
            </CardTitle>
            <ChevronDown
              className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <CardContent className="space-y-3 border-t border-border/80 px-6 pb-6 pt-4 dark:border-gray-800">
            <BidHistoryTable
              listingId={String(listing.id)}
              bids={initialBids}
              hasPendingEarlyAcceptance={hasPendingEarlyAcceptance}
              onAcceptBid={
                canManageListingAsLister && !hasActiveJob && isLive
                  ? handleAcceptBid
                  : undefined
              }
              closedAuctionBidStatus={closedAuctionBidStatus}
              showRevertLastBid={showRevertLastBidInHistory}
              onRevertLastBid={
                showRevertLastBidInHistory ? handleRevertLastBid : undefined
              }
              largeTouch
              buyNowJobOutcome={
                securedViaBuyNow &&
                hasActiveJob &&
                buyNowHistoryAmountCents != null &&
                buyNowHistoryAmountCents > 0
                  ? { amountCents: buyNowHistoryAmountCents }
                  : null
              }
            />
            {canManageListingAsLister && !hasActiveJob && isLive && (
              <p className="text-sm text-muted-foreground">
                {initialBids.length === 0 ? (
                  <>
                    When cleaners start bidding, their offers will appear in the table above. To hire
                    someone, open their row and tap{" "}
                    <strong>Accept bid</strong>
                    {" "}
                    — that locks in that cleaner for this job.
                  </>
                ) : (
                  <>
                    To confirm who you want, tap{" "}
                    <strong>Accept bid</strong>
                    {" "}
                    on that cleaner&apos;s row in the table above.
                  </>
                )}
              </p>
            )}
          </CardContent>
        </details>
      </Card>

      {!isCleaner && !isListerOwner && (
        <p className="text-center text-sm text-muted-foreground">
          Sign in as a cleaner to bid, or as the lister for this property to accept bids.
        </p>
      )}
    </div>
  );
}
