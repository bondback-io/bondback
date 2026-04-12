"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
} from "lucide-react";
import { formatCents } from "@/lib/listings";
import type { ListingRow } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { parseUtcTimestamp } from "@/lib/utils";
import { PlaceBidForm } from "@/components/features/place-bid-form";
import { BuyNowButton } from "@/components/features/buy-now-button";
import {
  BidHistoryTable,
  type BidWithBidder,
} from "@/components/features/bid-history-table";
import { requestEarlyBidAcceptance } from "@/lib/actions/early-bid-acceptance";
import { cancelLastBid } from "@/lib/actions/bids";
import { useToast } from "@/components/ui/use-toast";
import { showAppErrorToast } from "@/components/errors/show-app-error-toast";
import { logClientError } from "@/lib/errors/log-client-error";
import { CountdownTimer } from "@/components/features/countdown-timer";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";

export type ListingAuctionDetailProps = {
  listing: ListingRow;
  initialBids: BidWithBidder[];
  isCleaner: boolean;
  isListerOwner: boolean;
  /** Job row exists and is not cancelled — auction closed / work assigned */
  hasActiveJob: boolean;
  numericJobId: number | null;
  currentUserId: string | null;
};

/** Deduped URLs: cover first, then initial_photos, then photo_urls. */
function collectListingPhotoUrls(listing: ListingRow): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const push = (u: unknown) => {
    if (typeof u !== "string" || !u.trim()) return;
    const s = u.trim();
    if (seen.has(s)) return;
    seen.add(s);
    urls.push(s);
  };
  push(listing.cover_photo_url);
  if (Array.isArray(listing.initial_photos)) {
    listing.initial_photos.forEach(push);
  }
  if (Array.isArray(listing.photo_urls)) {
    listing.photo_urls.forEach(push);
  }
  return urls;
}

function humanizePropertyCondition(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const map: Record<string, string> = {
    excellent_very_good: "Excellent / very good",
    good: "Good",
    fair_average: "Fair / average",
    poor_bad: "Poor / bad",
  };
  return map[raw] ?? raw.replace(/_/g, " ");
}

function formatEndDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ListingAuctionDetail({
  listing,
  initialBids,
  isCleaner,
  isListerOwner,
  hasActiveJob,
  numericJobId,
  currentUserId,
}: ListingAuctionDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const isLive =
    listing.status === "live" && parseUtcTimestamp(listing.end_time) > Date.now();
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
            "The cleaner has been notified. They can proceed when you pay & start the job.",
        });
        router.refresh();
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

  const photoUrls = useMemo(() => collectListingPhotoUrls(listing), [listing]);
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
  const reserveCents = listing.reserve_cents ?? 0;
  const currentLowCents = listing.current_lowest_bid_cents ?? 0;
  const buyNowCents =
    typeof listing.buy_now_cents === "number" ? listing.buy_now_cents : null;

  const moveOut = listing.move_out_date?.trim()
    ? listing.move_out_date
    : null;
  const preferredRaw = (listing as { preferred_dates?: string[] | null }).preferred_dates;
  const preferredDates =
    Array.isArray(preferredRaw) && preferredRaw.length > 0
      ? preferredRaw.filter((d) => d && String(d).trim())
      : [];

  return (
    <div className="page-inner mx-auto max-w-4xl space-y-6 pb-10">
      <Button variant="ghost" asChild className="-ml-2 w-fit">
        <Link href={isListerOwner ? "/my-listings" : isCleaner ? "/dashboard" : "/jobs"}>
          ← Back
        </Link>
      </Button>

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
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="relative aspect-[16/10] max-h-[min(52vh,420px)] w-full bg-muted dark:bg-gray-900 md:aspect-[21/9] md:max-h-[380px]">
          {heroSrc ? (
            <Image
              src={heroSrc}
              alt=""
              fill
              priority
              className="object-cover"
              sizes="(max-width: 896px) 100vw, 896px"
              placeholder="blur"
              blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
            />
          ) : (
            <div className="flex h-full min-h-[200px] w-full items-center justify-center text-muted-foreground">
              <Images className="h-16 w-16 opacity-40" aria-hidden />
            </div>
          )}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
            aria-hidden
          />
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-balance text-2xl font-bold tracking-tight text-white drop-shadow md:text-3xl">
                  {listing.title ?? "Bond clean"}
                </h1>
                <p className="mt-1 flex items-center gap-2 text-sm text-white/90">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  {address}
                </p>
              </div>
              {isLive ? (
                <Badge className="shrink-0 border-0 bg-emerald-500/95 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg">
                  Live auction
                </Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {String(listing.status ?? "—")}
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
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground dark:text-gray-400">
                <span className="font-medium text-foreground dark:text-gray-200">Ends: </span>
                {formatEndDateTime(listing.end_time)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pricing + key stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-500/20 bg-emerald-500/[0.04] dark:border-emerald-800/40 dark:bg-emerald-950/25">
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
              Current lowest bid
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCents(currentLowCents)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
              Starting bid
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
              {formatCents(startingCents)}
            </p>
          </CardContent>
        </Card>
        {reserveCents > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                Reserve
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
                {formatCents(reserveCents)}
              </p>
            </CardContent>
          </Card>
        )}
        {buyNowCents != null && buyNowCents > 0 && (
          <Card className="border-violet-500/25 bg-violet-500/[0.06] dark:border-violet-800/40 dark:bg-violet-950/30">
            <CardContent className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                Buy now
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-violet-700 dark:text-violet-300">
                {formatCents(buyNowCents)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Property summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 shrink-0" aria-hidden />
            Property
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground dark:text-gray-400">
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
          {conditionLabel && (
            <p className="text-sm">
              <span className="font-medium text-foreground dark:text-gray-100">Condition: </span>
              {conditionLabel}
            </p>
          )}
          {levelsLabel && (
            <p className="text-sm">
              <span className="font-medium text-foreground dark:text-gray-100">Levels: </span>
              {levelsLabel}
            </p>
          )}
          {typeof listing.duration_days === "number" && listing.duration_days > 0 && (
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Auction listing period: <strong className="text-foreground dark:text-gray-200">{listing.duration_days} days</strong>
            </p>
          )}
          {addons.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground dark:text-gray-100">Add-ons</p>
              <div className="flex flex-wrap gap-2">
                {addons.map((a) => (
                  <Badge key={a} variant="outline" className="font-normal capitalize">
                    {String(a).replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dates */}
      {(moveOut || preferredDates.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 shrink-0" aria-hidden />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {moveOut && (
              <p>
                <span className="font-medium text-foreground dark:text-gray-100">Move-out: </span>
                {moveOut}
              </p>
            )}
            {preferredDates.length > 0 && (
              <div>
                <span className="font-medium text-foreground dark:text-gray-100">Preferred cleaning window: </span>
                <ul className="mt-1 list-inside list-disc text-muted-foreground dark:text-gray-400">
                  {preferredDates.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
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
                  onClick={() => setLightboxUrl(url)}
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

      <Dialog open={lightboxUrl != null} onOpenChange={(o) => !o && setLightboxUrl(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden border-0 bg-black/95 p-2 sm:p-4">
          <DialogTitle className="sr-only">Enlarged property photo</DialogTitle>
          {lightboxUrl && (
            <div className="relative aspect-auto max-h-[85vh] w-full">
              <Image
                src={lightboxUrl}
                alt=""
                width={1200}
                height={800}
                className="mx-auto h-auto max-h-[85vh] w-full rounded-lg object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-xl leading-tight md:text-2xl">About this listing</CardTitle>
            {isLive ? (
              <Badge className="shrink-0">Live</Badge>
            ) : (
              <Badge variant="secondary">{String(listing.status ?? "—")}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {listing.special_instructions?.trim() && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 dark:border-amber-800/40 dark:bg-amber-950/25">
              <h3 className="mb-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
                Special instructions
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-950/90 dark:text-amber-50/95">
                {listing.special_instructions}
              </p>
            </div>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Description</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground dark:text-gray-200">
              {listing.description?.trim() ? listing.description : "No description provided."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card id="bids">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gavel className="h-5 w-5" aria-hidden />
            Bids
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <BidHistoryTable
            bids={initialBids}
            hasPendingEarlyAcceptance={hasPendingEarlyAcceptance}
            onAcceptBid={
              isListerOwner && !hasActiveJob ? handleAcceptBid : undefined
            }
            showRevertLastBid={showRevertLastBidInHistory}
            onRevertLastBid={
              showRevertLastBidInHistory ? handleRevertLastBid : undefined
            }
            largeTouch
          />
          {isListerOwner && !hasActiveJob && isLive && (
            <p className="text-sm text-muted-foreground">
              Use <strong>Accept bid</strong> on a row above when you&apos;re ready to proceed with
              that cleaner.
            </p>
          )}
        </CardContent>
      </Card>

      {showCleanerBidUi && (
        <Card id="place-bid">
          <CardHeader>
            <CardTitle className="text-lg">Place a bid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {typeof listing.buy_now_cents === "number" && listing.buy_now_cents > 0 && (
              <BuyNowButton
                listingId={listing.id}
                buyNowCents={listing.buy_now_cents}
                currentUserId={currentUserId}
              />
            )}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Your bid</h3>
              <PlaceBidForm
                listingId={listing.id}
                listing={listing}
                isCleaner={isCleaner}
                currentUserId={currentUserId}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {!isCleaner && !isListerOwner && (
        <p className="text-center text-sm text-muted-foreground">
          Sign in as a cleaner to bid, or as the lister to accept bids.
        </p>
      )}
    </div>
  );
}
