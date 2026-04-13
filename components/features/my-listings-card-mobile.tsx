"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { CountdownTimer } from "@/components/features/countdown-timer";
import { VerificationBadges } from "@/components/shared/verification-badges";
import { Flame, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const HERO =
  "relative h-[min(46vw,220px)] w-full min-h-[150px] max-h-[220px] overflow-hidden bg-muted sm:h-[200px] sm:min-h-[180px] dark:bg-gray-800";

export type MyListingsCardMobileProps = {
  listingId: string | number;
  title: string;
  coverUrl: string;
  /** When set, shows the same verified/trust chips as marketplace JobCard */
  listerVerificationBadges?: string[] | null;
  showHot?: boolean;
  showCountdown?: boolean;
  endTime?: string | null;
  statusPill: string;
  statusPillClassName: string;
  priceLabel: string;
  priceDisplay: string;
  locationLine: string;
  bedsBathsLine: string;
  /** Extra body (job summary, fees — keep short on mobile) */
  children?: ReactNode;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  showCancel?: boolean;
  onCancel?: () => void;
  /** Expired listing: run auction again with same settings */
  showRelist?: boolean;
  onRelist?: () => void;
  relistLoading?: boolean;
  cardClassName?: string;
};

/**
 * Mobile-only (&lt;768px) lister “My listings” card — matches JobCard marketplace rhythm.
 */
export function MyListingsCardMobile({
  listingId,
  title,
  coverUrl,
  listerVerificationBadges = null,
  showHot = false,
  showCountdown = false,
  endTime,
  statusPill,
  statusPillClassName,
  priceLabel,
  priceDisplay,
  locationLine,
  bedsBathsLine,
  children,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  showCancel,
  onCancel,
  showRelist,
  onRelist,
  relistLoading,
  cardClassName,
}: MyListingsCardMobileProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-lg ring-1 ring-black/[0.04] dark:border-gray-700 dark:bg-gray-950 dark:ring-white/[0.06]",
        cardClassName
      )}
    >
      <div className={HERO}>
        <Link
          href={primaryHref}
          className="absolute inset-0 block"
          aria-label={`Open listing: ${title}`}
        >
          <OptimizedImage
            src={coverUrl}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent md:from-black/55 md:via-black/12" aria-hidden />
        </Link>
        <div className="absolute left-3 right-3 top-3 z-10 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {listerVerificationBadges && listerVerificationBadges.length > 0 ? (
              <VerificationBadges badges={listerVerificationBadges} showLabel size="lg" />
            ) : (
              <Badge
                variant="secondary"
                className="border border-emerald-500/40 bg-emerald-600/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm dark:bg-emerald-700"
              >
                Your listing
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {showHot && (
              <Badge className="gap-1 border border-orange-400/70 bg-orange-500/95 px-2 py-1 text-[10px] font-bold uppercase text-white shadow-md dark:bg-orange-600">
                <Flame className="h-3 w-3" aria-hidden />
                Hot
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 border-t border-border px-4 pb-5 pt-4 dark:border-gray-800 sm:gap-4">
        {showCountdown && endTime && (
          <div
            className="flex items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-sm font-semibold text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
            aria-live="polite"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-amber-800/90 dark:text-amber-200/90">
              Auction ends
            </span>
            <CountdownTimer
              endTime={endTime}
              expiredLabel="Ended"
              className="tabular-nums text-base font-bold text-amber-900 dark:text-amber-50"
            />
          </div>
        )}

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
            {priceLabel}
          </p>
          <p className="text-3xl font-extrabold tabular-nums leading-none text-emerald-600 dark:text-emerald-400 sm:text-4xl">
            {priceDisplay}
          </p>
          <div
            className={cn(
              "inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold leading-snug sm:text-base",
              statusPillClassName
            )}
          >
            {statusPill}
          </div>
        </div>

        <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground dark:text-gray-100 sm:text-base">
          {title}
        </p>
        <p className="text-sm text-muted-foreground dark:text-gray-400 sm:text-base">{locationLine}</p>
        <p className="text-sm text-muted-foreground dark:text-gray-500 sm:text-base">{bedsBathsLine}</p>

        {children}

        <div className="flex flex-col gap-2.5 pt-1 sm:gap-3">
          {showRelist && onRelist && (
            <Button
              type="button"
              size="lg"
              className="min-h-[48px] w-full touch-manipulation rounded-xl text-base font-semibold shadow-md active:scale-[0.98]"
              disabled={relistLoading}
              onClick={onRelist}
            >
              {relistLoading ? "Relisting…" : "Relist"}
            </Button>
          )}
          <Button
            asChild
            size="lg"
            className="min-h-[48px] w-full touch-manipulation rounded-xl text-base font-semibold shadow-md active:scale-[0.98]"
          >
            <Link href={primaryHref} className="flex items-center justify-center gap-2 no-underline hover:no-underline">
              <Eye className="h-5 w-5 shrink-0" aria-hidden />
              {primaryLabel}
            </Link>
          </Button>
          {secondaryHref && secondaryLabel && (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-[48px] w-full touch-manipulation rounded-xl border-2 text-base font-semibold active:scale-[0.98] dark:border-gray-600 dark:bg-transparent dark:hover:bg-gray-800"
            >
              <Link href={secondaryHref} className="no-underline hover:no-underline">
                {secondaryLabel}
              </Link>
            </Button>
          )}
          {showCancel && onCancel && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-[48px] w-full touch-manipulation rounded-xl border-2 border-amber-400/60 text-base font-semibold text-amber-900 hover:bg-amber-50 active:scale-[0.98] dark:border-amber-600 dark:text-amber-100 dark:hover:bg-amber-950/40"
              onClick={onCancel}
            >
              Cancel listing
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
