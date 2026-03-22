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

const HERO = "relative h-[200px] w-full min-h-[180px] max-h-[220px] overflow-hidden bg-muted dark:bg-gray-800";

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
  cardClassName,
}: MyListingsCardMobileProps) {
  const jid = String(listingId);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md dark:border-gray-800 dark:bg-gray-950",
        cardClassName
      )}
    >
      <div className={HERO}>
        <Link
          href={`/jobs/${jid}`}
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" aria-hidden />
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

      <div className="flex flex-col gap-4 border-t border-border px-4 pb-5 pt-4 dark:border-gray-800">
        {showCountdown && endTime && (
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
            <CountdownTimer endTime={endTime} expiredLabel="Ended" className="tabular-nums" />
          </div>
        )}

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{priceLabel}</p>
          <p className="text-4xl font-extrabold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
            {priceDisplay}
          </p>
          <div
            className={cn(
              "inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border-2 px-3 py-2 text-base font-bold leading-tight",
              statusPillClassName
            )}
          >
            {statusPill}
          </div>
        </div>

        <p className="line-clamp-2 text-base font-semibold leading-snug text-foreground dark:text-gray-100">{title}</p>
        <p className="text-base text-muted-foreground dark:text-gray-400">{locationLine}</p>
        <p className="text-base text-muted-foreground dark:text-gray-500">{bedsBathsLine}</p>

        {children}

        <div className="flex flex-col gap-3 pt-1">
          <Button asChild size="lg" className="min-h-12 w-full rounded-xl text-base font-semibold shadow-md">
            <Link href={primaryHref} className="flex items-center justify-center gap-2">
              <Eye className="h-5 w-5 shrink-0" aria-hidden />
              {primaryLabel}
            </Link>
          </Button>
          {secondaryHref && secondaryLabel && (
            <Button asChild size="lg" variant="secondary" className="min-h-12 w-full rounded-xl text-base font-semibold">
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          )}
          {showCancel && onCancel && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-12 w-full rounded-xl border-2 border-amber-400/60 text-base font-semibold text-amber-900 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-100 dark:hover:bg-amber-950/40"
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
