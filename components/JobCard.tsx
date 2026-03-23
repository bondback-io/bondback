"use client";

/**
 * Mobile-only (<768px) marketplace job/listing card shell — Airtasker-style hero + bold price + CTAs.
 * Desktop layouts stay in listing-card / dashboard-* with `hidden md:block`.
 */

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { addSavedListingId } from "@/lib/saved-listings-local";
import { cn } from "@/lib/utils";
import { Home, Flame, Eye, Gavel, MessageCircle, Bookmark } from "lucide-react";
import { BuyNowButton } from "@/components/features/buy-now-button";
import { VerificationBadges } from "@/components/shared/verification-badges";
import type { ReactNode } from "react";

const HERO_H = "min-h-[180px] max-h-[220px] h-[200px]";

/** Short countdown for status line, e.g. "4h left" */
export function formatAuctionTimeLeftShort(endMs: number): string {
  const ms = endMs - Date.now();
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 72) return `${Math.round(h / 24)}d left`;
  if (h >= 1) return `${h}h left`;
  if (m < 1) return "<1m left";
  return `${m}m left`;
}

export type JobCardMarketplaceMobileProps = {
  jobHref: string;
  listingId: string;
  title: string;
  thumb: string | null;
  thumbAlt: string;
  /** Main price line, e.g. "$420" */
  priceDisplay: string;
  priceLabel: string;
  /** e.g. "Live · 4h left" or "Ending Soon" */
  statusLine: string;
  statusVariant: "live" | "ending_soon" | "expired";
  /** One line: suburb + beds/baths */
  locationLine: string;
  beds: number | null | undefined;
  baths: number | null | undefined;
  isHot: boolean;
  listerVerificationBadges: string[] | null;
  showListerTrust: boolean;
  menu: ReactNode;
  priority?: boolean;
  isLive: boolean;
  showCleanerMobileActions: boolean;
  showPlaceBid: boolean;
  hasBuyNow: boolean;
  buyNowCents: number | null;
  isListerOwner: boolean;
  showListerActions: boolean;
  hasAssignedCleaner: boolean;
  hideCleanerCancelledAuctionUi: boolean;
  /** Tighter horizontal row layout (e.g. /jobs mobile list). */
  layout?: "default" | "compact";
};

export function JobCardMarketplaceMobile({
  jobHref,
  listingId,
  title,
  thumb,
  thumbAlt,
  priceDisplay,
  priceLabel,
  statusLine,
  statusVariant,
  locationLine,
  beds,
  baths,
  isHot,
  listerVerificationBadges,
  showListerTrust,
  menu,
  priority = false,
  isLive,
  showCleanerMobileActions,
  showPlaceBid,
  hasBuyNow,
  buyNowCents,
  isListerOwner,
  showListerActions,
  hasAssignedCleaner,
  hideCleanerCancelledAuctionUi,
  layout = "default",
}: JobCardMarketplaceMobileProps) {
  const { toast } = useToast();

  const handleSave = () => {
    addSavedListingId(String(listingId));
    toast({
      title: "Saved",
      description: "Stored on this device — open the listing anytime from favourites.",
    });
  };

  const statusColors =
    statusVariant === "live"
      ? "border-emerald-300/80 bg-emerald-500/15 text-emerald-900 dark:border-emerald-600/50 dark:bg-emerald-950/60 dark:text-emerald-100"
      : statusVariant === "ending_soon"
        ? "border-amber-400/80 bg-amber-500/20 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/50 dark:text-amber-100"
        : "border-border bg-muted text-muted-foreground dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300";

  const bedsBaths =
    beds != null || baths != null
      ? `${beds ?? "—"} bed · ${baths ?? "—"} bath`
      : null;

  if (layout === "compact") {
    return (
      <div className="flex w-full flex-col overflow-hidden rounded-xl bg-transparent">
        <div className="flex flex-row gap-3 p-3">
          <Link
            href={jobHref}
            className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg bg-muted dark:bg-gray-800"
            aria-label={`View listing: ${title}`}
          >
            {thumb ? (
              <Image
                src={thumb}
                alt={thumbAlt}
                fill
                sizes="96px"
                quality={75}
                className="object-cover"
                loading={priority ? "eager" : "lazy"}
                priority={priority}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground" aria-hidden>
                <Avatar className="h-12 w-12 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-muted/80 dark:bg-gray-700">
                    <Home className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </Link>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground dark:text-gray-100">
                {title}
              </h3>
              <div className="shrink-0">{menu}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-500">
                  {priceLabel}
                </p>
                <p className="text-lg font-bold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
                  {priceDisplay}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex max-w-full rounded-md border px-2 py-0.5 text-[10px] font-bold leading-tight",
                  statusColors
                )}
              >
                {statusLine}
              </span>
              {isHot && (
                <Badge
                  className="gap-0.5 border border-orange-400/70 bg-orange-500/95 px-1.5 py-0 text-[10px] font-bold uppercase text-white dark:bg-orange-600"
                  aria-label="Hot job"
                >
                  <Flame className="h-3 w-3 shrink-0" aria-hidden />
                  Hot
                </Badge>
              )}
            </div>

            <p className="line-clamp-1 text-xs text-muted-foreground dark:text-gray-400">
              {locationLine}
            </p>
            {bedsBaths && (
              <p className="text-[11px] text-muted-foreground dark:text-gray-500">{bedsBaths}</p>
            )}
            {showListerTrust &&
              listerVerificationBadges &&
              listerVerificationBadges.length > 0 && (
                <VerificationBadges badges={listerVerificationBadges} showLabel size="sm" />
              )}

            <div className="mt-1 flex flex-wrap gap-2 pt-0.5">
              <Button
                asChild
                size="sm"
                className="h-9 min-h-9 flex-1 rounded-lg text-xs font-semibold sm:flex-none sm:px-4"
              >
                <Link href={jobHref} className="inline-flex items-center justify-center gap-1.5">
                  <Eye className="h-4 w-4 shrink-0" aria-hidden />
                  View
                </Link>
              </Button>
              {showCleanerMobileActions &&
                hasBuyNow &&
                buyNowCents != null &&
                !hideCleanerCancelledAuctionUi && (
                  <BuyNowButton
                    listingId={listingId}
                    buyNowCents={buyNowCents}
                    disabled={!isLive}
                    className="h-9 min-h-9 flex-1 rounded-lg border-0 bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
                  />
                )}
              {showCleanerMobileActions && showPlaceBid && !hideCleanerCancelledAuctionUi && (
                <Button
                  asChild
                  size="sm"
                  className="h-9 min-h-9 flex-1 rounded-lg border-0 bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500"
                >
                  <Link href={jobHref} className="inline-flex items-center justify-center gap-1.5">
                    <Gavel className="h-4 w-4 shrink-0" aria-hidden />
                    Bid
                  </Link>
                </Button>
              )}
            </div>

            {showCleanerMobileActions && !hideCleanerCancelledAuctionUi && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 min-h-8 flex-1 rounded-lg text-xs"
                  onClick={handleSave}
                >
                  <Bookmark className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Save
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 min-h-8 flex-1 rounded-lg text-xs dark:border-gray-600"
                >
                  <Link href={`/messages?job=${listingId}`} className="inline-flex items-center justify-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Msg
                  </Link>
                </Button>
              </div>
            )}

            {isListerOwner && showListerActions && isLive && (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm" className="h-8 min-h-8 rounded-lg text-xs">
                  <Link href={jobHref} className="inline-flex items-center gap-1">
                    <Gavel className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Bids
                  </Link>
                </Button>
                {hasAssignedCleaner && (
                  <Button asChild variant="outline" size="sm" className="h-8 min-h-8 rounded-lg text-xs">
                    <Link href={`/messages?job=${listingId}`} className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Message
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl">
      {/* Hero */}
      <div className={cn("relative w-full overflow-hidden bg-muted dark:bg-gray-800", HERO_H)}>
        <Link
          href={jobHref}
          className="absolute inset-0 z-0 flex min-h-[48px] min-w-[48px] items-center justify-center transition-transform active:scale-[0.99]"
          aria-label={`View listing: ${title}`}
        >
          {thumb ? (
            <Image
              src={thumb}
              alt={thumbAlt}
              fill
              sizes="100vw"
              quality={80}
              className="object-cover"
              loading={priority ? "eager" : "lazy"}
              priority={priority}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground" aria-hidden>
              <Avatar className="h-20 w-20 rounded-2xl">
                <AvatarFallback className="rounded-2xl bg-muted/80 dark:bg-gray-700">
                  <Home className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent dark:from-black/60" aria-hidden />
        </Link>

        {/* Top bar: menu left area + trust right */}
        <div className="absolute left-3 right-3 top-3 z-10 flex items-start justify-between gap-2">
          <div className="min-w-0 shrink">{menu}</div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5">
            {showListerTrust && listerVerificationBadges && listerVerificationBadges.length > 0 && (
              <VerificationBadges badges={listerVerificationBadges} showLabel size="lg" />
            )}
            {isHot && (
              <Badge
                className="gap-1 border border-orange-400/70 bg-orange-500/95 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md dark:bg-orange-600"
                aria-label="Hot job"
              >
                <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Hot
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-4 border-t border-border bg-card px-4 pb-5 pt-4 text-foreground dark:border-gray-800 dark:bg-gray-950 sm:px-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
            {priceLabel}
          </p>
          <p
            className={cn(
              "text-4xl font-extrabold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400",
              "leading-none"
            )}
          >
            {priceDisplay}
          </p>
          <div
            className={cn(
              "inline-flex w-fit max-w-full rounded-xl border-2 px-3 py-2 text-base font-bold leading-tight",
              statusColors
            )}
          >
            {statusLine}
          </div>
        </div>

        <p className="text-base font-medium leading-snug text-foreground dark:text-gray-100">
          {locationLine}
        </p>
        {bedsBaths && (
          <p className="text-base text-muted-foreground dark:text-gray-400">{bedsBaths}</p>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3 pt-1">
          <Button
            asChild
            size="lg"
            className="min-h-12 w-full rounded-xl text-base font-semibold shadow-md active:scale-[0.98]"
          >
            <Link href={jobHref} className="flex items-center justify-center gap-2">
              <Eye className="h-5 w-5 shrink-0" aria-hidden />
              View Details
            </Link>
          </Button>

          {showCleanerMobileActions && hasBuyNow && buyNowCents != null && !hideCleanerCancelledAuctionUi && (
            <BuyNowButton
              listingId={listingId}
              buyNowCents={buyNowCents}
              disabled={!isLive}
              className="min-h-12 w-full rounded-xl border-0 bg-violet-600 text-base font-semibold text-white hover:bg-violet-700 active:scale-[0.98] dark:bg-violet-600 dark:hover:bg-violet-500"
            />
          )}

          {showCleanerMobileActions && showPlaceBid && !hideCleanerCancelledAuctionUi && (
            <Button
              asChild
              size="lg"
              className="min-h-12 w-full rounded-xl border-0 bg-sky-600 text-base font-semibold text-white shadow-sm hover:bg-sky-700 active:scale-[0.98] dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <Link href={jobHref} className="flex items-center justify-center gap-2">
                <Gavel className="h-5 w-5 shrink-0" aria-hidden />
                Bid Now
              </Link>
            </Button>
          )}

          {showCleanerMobileActions && !hideCleanerCancelledAuctionUi && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="min-h-12 rounded-xl text-base font-semibold active:scale-[0.98]"
                onClick={handleSave}
              >
                <Bookmark className="mr-2 h-5 w-5 shrink-0" aria-hidden />
                Save
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="min-h-12 rounded-xl border-2 text-base font-semibold active:scale-[0.98] dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                <Link href={`/messages?job=${listingId}`} className="flex items-center justify-center gap-2">
                  <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
                  Message
                </Link>
              </Button>
            </div>
          )}

          {isListerOwner && showListerActions && isLive && (
            <div className="flex flex-col gap-3">
              <Button asChild variant="secondary" size="lg" className="min-h-12 w-full rounded-xl text-base font-semibold">
                <Link href={jobHref} className="flex items-center justify-center gap-2">
                  <Gavel className="h-5 w-5 shrink-0" aria-hidden />
                  View Bids
                </Link>
              </Button>
              {hasAssignedCleaner && (
                <Button asChild variant="outline" size="lg" className="min-h-12 w-full rounded-xl border-2 text-base font-semibold">
                  <Link href={`/messages?job=${listingId}`} className="flex items-center justify-center gap-2">
                    <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
                    Message Cleaner
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
