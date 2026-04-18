"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, Gavel, MapPin, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatCents,
  getListingCoverUrl,
  type ListingRow,
} from "@/lib/listings";
import { hrefListingOrJob } from "@/lib/navigation/listing-or-job-href";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { cn, parseUtcTimestamp } from "@/lib/utils";
export type FindJobsCompactRowProps = {
  listing: ListingRow;
  bidCount: number;
  distanceKm?: number;
  selected: boolean;
  listerName?: string | null;
  /** Profile photo URL from `profiles.avatar_url` (batch-loaded with lister card data). */
  listerAvatarUrl?: string | null;
  onSelect: () => void;
  /** Prefetch listing detail route on hover for faster navigation. */
  onPrefetchEnter?: () => void;
  /** First rows: eager-load hero thumbnail (LCP). */
  imagePriority?: boolean;
};

function listerInitials(name: string | null | undefined): string {
  const t = (name ?? "").trim();
  if (!t) return "";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0] ?? "";
    const b = parts[parts.length - 1]![0] ?? "";
    return `${a}${b}`.toUpperCase().slice(0, 2);
  }
  return t.slice(0, 2).toUpperCase();
}

function formatEndsShort(endTime: string | null | undefined): string {
  if (!endTime) return "";
  const end = parseUtcTimestamp(String(endTime));
  if (!Number.isFinite(end)) return "";
  const ms = end - Date.now();
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d left`;
  if (h >= 1) return `${h}h left`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${m}m left`;
}

/**
 * Airtasker-style compact row: title + price, meta lines, small thumb, avatar.
 */
export function FindJobsCompactRow({
  listing,
  bidCount,
  distanceKm,
  selected,
  listerName,
  listerAvatarUrl = null,
  onSelect,
  onPrefetchEnter,
  imagePriority = false,
}: FindJobsCompactRowProps) {
  const title = listing.title?.trim() || "Bond clean";
  const href = hrefListingOrJob(
    { id: listing.id, status: listing.status, end_time: listing.end_time },
    undefined
  );
  const thumb = getListingCoverUrl(listing);
  const price = formatCents(listing.current_lowest_bid_cents ?? 0);
  const loc = [listing.suburb, listing.postcode].filter(Boolean).join(" ") || "—";
  const ends = formatEndsShort(listing.end_time);
  const avatarSrc = listerAvatarUrl?.trim() || null;
  const initials = listerInitials(listerName);

  return (
    <div
      data-find-job-card={listing.id}
      onPointerEnter={onPrefetchEnter}
      className={cn(
        "group border-b border-border/80 bg-card/40 transition-colors dark:border-gray-800 dark:bg-gray-950/30",
        selected && "bg-primary/[0.06] ring-1 ring-inset ring-primary/25 dark:bg-primary/10"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full gap-3 px-3 py-3 text-left sm:px-4"
      >
        <div className="relative h-[72px] w-[88px] shrink-0 overflow-hidden rounded-lg bg-muted dark:bg-gray-800">
          {thumb ? (
            <Image
              src={thumb}
              alt=""
              fill
              sizes="88px"
              className="object-cover"
              placeholder="blur"
              blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
              priority={imagePriority}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
              No photo
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground dark:text-gray-100">
              {title}
            </p>
            <span className="shrink-0 text-lg font-bold tabular-nums leading-none text-emerald-600 dark:text-emerald-400 md:text-xl">
              {price}
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-gray-400">
            <MapPin className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="truncate">{loc}</span>
            {distanceKm != null && !Number.isNaN(distanceKm) && (
              <span className="shrink-0 text-muted-foreground/90">· ~{distanceKm.toFixed(0)} km</span>
            )}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-gray-500">
            <Calendar className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            <span>{ends}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Badge
              variant="secondary"
              className="h-5 gap-1 px-1.5 text-[10px] font-medium text-emerald-900 dark:text-emerald-100"
            >
              <Gavel className="h-3 w-3" aria-hidden />
              Live
            </Badge>
            <span className="text-[11px] text-muted-foreground dark:text-gray-500">
              {bidCount} bid{bidCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-center gap-1">
          <div
            className="relative h-8 w-8 overflow-hidden rounded-full border border-border/80 bg-muted dark:border-gray-700 sm:h-9 sm:w-9"
            aria-hidden
          >
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt=""
                fill
                sizes="36px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted dark:bg-gray-800">
                {initials ? (
                  <span className="text-[10px] font-semibold text-foreground/80 dark:text-gray-200">
                    {initials}
                  </span>
                ) : (
                  <User className="h-4 w-4 text-muted-foreground dark:text-gray-500" aria-hidden />
                )}
              </div>
            )}
          </div>
          <Link
            href={href}
            prefetch
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] font-medium text-primary underline-offset-2 hover:underline"
          >
            Open
          </Link>
        </div>
      </button>
    </div>
  );
}
