"use client";

import Link from "next/link";
import { MapPin, MoreHorizontal, Gavel, Ban, Trash2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/listings";
import type { ListingRow } from "@/lib/listings";
import { ListingCoverImage } from "@/components/listing/listing-cover-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BadgeTone } from "@/lib/my-listings/lister-listing-helpers";
import { NEXT_IMAGE_SIZES_LISTER_LISTING_THUMB } from "@/lib/next-image-sizes";

const toneClasses: Record<BadgeTone, string> = {
  emerald: "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-100",
  sky: "border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-100",
  amber: "border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100",
  slate: "border-border bg-muted/80 text-muted-foreground dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200",
  rose: "border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-100",
  violet: "border-violet-200/80 bg-violet-50 text-violet-900 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-100",
};

export type ListerListingCardProps = {
  listing: ListingRow;
  addressLine: string;
  badgeLabel: string;
  badgeTone: BadgeTone;
  bidCount: number;
  highestBidCents: number;
  buyNowCents: number | null;
  timeLabel: string;
  /** Listing is in an open auction (receives bids until end time). */
  isLiveBidding?: boolean;
  showEndEarly: boolean;
  href: string;
  onEndEarly?: () => void;
  onRelist?: () => void;
  relistLoading?: boolean;
  onDiscardDraft?: () => void;
  /** When set, card is a local draft resume row (not a DB listing) */
  isLocalDraft?: boolean;
};

export function ListerListingCard({
  listing,
  addressLine,
  badgeLabel,
  badgeTone,
  bidCount,
  highestBidCents,
  buyNowCents,
  timeLabel,
  isLiveBidding = false,
  showEndEarly,
  href,
  onEndEarly,
  onRelist,
  relistLoading = false,
  onDiscardDraft,
  isLocalDraft = false,
}: ListerListingCardProps) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm ring-1 ring-black/[0.03] dark:border-gray-800 dark:bg-gray-950 dark:ring-white/[0.04]",
        "transition-[box-shadow,transform] duration-200 hover:shadow-md active:scale-[0.99]",
        isLiveBidding &&
          "border-emerald-400/70 bg-emerald-50/40 ring-2 ring-emerald-500/25 dark:border-emerald-700/50 dark:bg-emerald-950/25 dark:ring-emerald-500/20"
      )}
    >
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        <Link
          href={href}
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28"
          aria-label={`Open ${listing.title}`}
        >
          <ListingCoverImage
            listing={listing}
            alt=""
            fill
            sizes={NEXT_IMAGE_SIZES_LISTER_LISTING_THUMB}
            className="object-cover"
          />
        </Link>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={href} className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground hover:underline sm:text-base">
                {listing.title || "Untitled listing"}
              </Link>
              <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground dark:text-gray-400">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="line-clamp-2">{addressLine}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground dark:text-gray-500">
                {listing.bedrooms} bed · {listing.bathrooms} bath
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl text-muted-foreground hover:bg-muted"
                  aria-label="Listing actions"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {!isLocalDraft && (
                  <>
                    <DropdownMenuItem asChild className="min-h-11 cursor-pointer text-base">
                      <Link href={href}>
                        <Gavel className="mr-2 h-4 w-4" />
                        View bids &amp; job
                      </Link>
                    </DropdownMenuItem>
                    {showEndEarly && onEndEarly && (
                      <DropdownMenuItem
                        className="min-h-11 cursor-pointer text-base text-amber-700 focus:text-amber-800 dark:text-amber-300"
                        onClick={() => onEndEarly()}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        End auction early
                      </DropdownMenuItem>
                    )}
                    {onRelist && (
                      <DropdownMenuItem
                        className="min-h-11 cursor-pointer text-base"
                        disabled={relistLoading}
                        onClick={() => onRelist()}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Relist
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
                {isLocalDraft && onDiscardDraft && (
                  <DropdownMenuItem
                    className="min-h-11 cursor-pointer text-base text-destructive focus:text-destructive"
                    onClick={() => onDiscardDraft()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Discard draft
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold", toneClasses[badgeTone])}>
              {badgeLabel}
            </Badge>
            {timeLabel ? (
              <span className="text-[11px] text-muted-foreground dark:text-gray-500">{timeLabel}</span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-xs dark:bg-gray-900/50 sm:hidden">
            <div>
              <p className="font-medium text-muted-foreground dark:text-gray-400">Bids</p>
              <p className="text-base font-semibold tabular-nums text-foreground dark:text-gray-100">{bidCount}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground dark:text-gray-400">Top bid</p>
              <p className="text-base font-semibold tabular-nums text-foreground dark:text-gray-100">
                {formatCents(highestBidCents)}
              </p>
            </div>
            {buyNowCents != null && buyNowCents > 0 && (
              <div className="col-span-2">
                <p className="font-medium text-muted-foreground dark:text-gray-400">Buy now</p>
                <p className="text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatCents(buyNowCents)}
                </p>
              </div>
            )}
          </div>

          <div className="hidden sm:grid sm:grid-cols-3 sm:gap-2 sm:rounded-xl sm:bg-muted/50 sm:px-3 sm:py-2">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Bids</p>
              <p className="text-sm font-semibold tabular-nums">{bidCount}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Highest bid</p>
              <p className="text-sm font-semibold tabular-nums">{formatCents(highestBidCents)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Buy now</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {buyNowCents != null && buyNowCents > 0 ? formatCents(buyNowCents) : "—"}
              </p>
            </div>
          </div>

          <div className="pt-0.5">
            <Button
              asChild
              className="h-11 w-full rounded-xl text-base font-semibold sm:h-10 sm:max-w-xs"
              size="lg"
            >
              <Link href={href}>Open listing</Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
