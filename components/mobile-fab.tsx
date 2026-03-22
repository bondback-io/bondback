"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { Plus, Search, MapPin, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardJobCard } from "@/components/dashboard/dashboard-job-card";
import type { DashboardJobCardProps } from "@/components/dashboard/dashboard-job-card";
import { DashboardListingCard } from "@/components/dashboard/dashboard-listing-card";
import type { DashboardListingCardProps } from "@/components/dashboard/dashboard-listing-card";
import {
  DashboardJobCardWithSwipe,
  DashboardListingCardWithSwipe,
} from "@/components/dashboard/dashboard-cards-swipe";

/** Primary contextual FAB for lister/cleaner dashboards (mobile only). Sits above the tab bar; leaves room for the layout icon FAB on the right. */
export function MobileDashboardFab({
  variant,
}: {
  variant: "lister" | "cleaner";
}) {
  const isLister = variant === "lister";
  const href = isLister ? "/listings/new" : "/jobs";
  const label = isLister ? "Create New Listing" : "Find Nearby Jobs";

  return (
    <Link
      href={href}
      className={cn(
        "fixed left-4 right-[4.75rem] z-[55] flex items-center justify-center gap-2 rounded-full px-4 py-3.5 text-sm font-semibold text-white shadow-2xl transition active:scale-[0.98] sm:text-base md:hidden",
        "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))]",
        isLister
          ? "bg-emerald-600 ring-2 ring-emerald-400/40 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          : "bg-blue-600 ring-2 ring-blue-400/40 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
      )}
      aria-label={label}
    >
      {isLister ? (
        <Plus className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden />
      ) : (
        <Search className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden />
      )}
      <span className="truncate">{label}</span>
    </Link>
  );
}

function DotNav({
  count,
  index,
  onSelect,
}: {
  count: number;
  index: number;
  onSelect: (i: number) => void;
}) {
  if (count <= 1) return null;
  return (
    <div className="flex justify-center gap-2 pt-4" role="tablist" aria-label="Slide">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === index}
          className={cn(
            "h-2.5 min-w-2.5 rounded-full transition-all duration-200",
            i === index
              ? "w-8 bg-primary"
              : "w-2.5 bg-muted-foreground/40 hover:bg-muted-foreground/60"
          )}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}

function useCarouselIndex(length: number) {
  const [index, setIndex] = useState(0);
  const clamp = useCallback(
    (n: number) => Math.max(0, Math.min(length - 1, n)),
    [length]
  );
  const next = useCallback(() => setIndex((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);
  const go = useCallback((i: number) => setIndex(clamp(i)), [clamp]);
  const handlers = useSwipeable({
    onSwipedLeft: next,
    onSwipedRight: prev,
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true,
  });
  return { index, go, handlers };
}

/** Cleaner: stacked cards on small screens with per-card swipe actions; grid from md up. */
export function ResponsiveCleanerJobCards({
  items,
  ratingStars,
}: {
  items: DashboardJobCardProps[];
  /** Optional prominent rating strip (cleaner dashboard). */
  ratingStars?: number | null;
}) {
  if (items.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-4 md:hidden">
        {ratingStars != null && !Number.isNaN(ratingStars) && (
          <div className="mb-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-200/80 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-100">
            <Star className="h-6 w-6 fill-amber-400 text-amber-600 dark:fill-amber-500 dark:text-amber-300" aria-hidden />
            <span className="text-lg font-bold tabular-nums">{ratingStars.toFixed(1)}</span>
            <span className="text-sm font-semibold uppercase tracking-wide text-amber-800/90 dark:text-amber-200/90">
              Your rating
            </span>
          </div>
        )}
        {items.map((props) => (
          <div
            key={String(props.job.id)}
            className="[&_.text-sm]:text-base [&_.text-xs]:text-sm [&_h3]:text-lg [&_h3]:font-bold [&_button]:min-h-11 [&_button]:px-5 [&_button]:text-sm"
          >
            <DashboardJobCardWithSwipe {...props} />
          </div>
        ))}
        <p className="text-center text-xs text-muted-foreground dark:text-gray-500">
          Swipe right: complete or open · Swipe left: message lister
        </p>
      </div>

      {/* Tablet+ grid */}
      <div className="hidden gap-6 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-8">
        {items.map((props) => (
          <div
            key={String(props.job.id)}
            className="[&_.text-sm]:text-[15px] [&_h3]:text-base"
          >
            <DashboardJobCard {...props} />
          </div>
        ))}
      </div>
    </>
  );
}

/** Lister: stacked live listing cards on small screens with per-card swipe actions. */
export function ResponsiveListerListingCards({
  items,
}: {
  items: DashboardListingCardProps[];
}) {
  if (items.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-4 md:hidden">
        {items.map((props) => (
          <div
            key={String((props.listing as { id: string }).id)}
            className="[&_.text-sm]:text-base [&_.text-xs]:text-sm [&_h3]:text-lg [&_h3]:font-bold [&_button]:min-h-11 [&_button]:px-5 [&_button]:text-sm"
          >
            <DashboardListingCardWithSwipe {...props} />
          </div>
        ))}
        <p className="text-center text-xs text-muted-foreground dark:text-gray-500">
          Swipe right: view bids · Swipe left: cancel listing
        </p>
      </div>

      <div className="hidden gap-6 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-8">
        {items.map((props) => (
          <div
            key={String((props.listing as { id: string }).id)}
            className="[&_.text-sm]:text-[15px] [&_h3]:text-base"
          >
            <DashboardListingCard {...props} />
          </div>
        ))}
      </div>
    </>
  );
}

export type ListerActiveJobSwipeItem = {
  jobId: number;
  title: string;
  suburb?: string | null;
  postcode?: string | null;
};

/** Lister dashboard: large swipeable cards for active jobs list (mobile). */
export function SwipeableListerActiveJobs({
  items,
}: {
  items: ListerActiveJobSwipeItem[];
}) {
  const { index, go, handlers } = useCarouselIndex(items.length);

  if (items.length === 0) return null;

  return (
    <>
      <div className="md:hidden">
        <div
          {...handlers}
          className="touch-pan-y overflow-hidden rounded-3xl border-2 border-primary/20 bg-primary/5 p-3 dark:border-primary/30 dark:bg-primary/10"
        >
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {items.map((item) => (
              <div key={item.jobId} className="w-full shrink-0 px-1">
                <Link
                  href={`/jobs/${item.jobId}`}
                  className="flex min-h-[8rem] flex-col justify-between rounded-2xl border-2 border-border bg-card p-5 shadow-sm transition active:scale-[0.99] dark:border-gray-700 dark:bg-gray-900"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Active job
                    </p>
                    <p className="mt-2 line-clamp-2 text-xl font-bold leading-snug text-foreground dark:text-gray-50">
                      {item.title}
                    </p>
                    {(item.suburb || item.postcode) && (
                      <p className="mt-3 flex items-center gap-2 text-base text-muted-foreground">
                        <MapPin className="h-5 w-5 shrink-0" />
                        {[item.suburb, item.postcode].filter(Boolean).join(" ")}
                      </p>
                    )}
                  </div>
                  <span className="mt-4 flex items-center justify-end gap-1 text-lg font-semibold text-primary">
                    Open job
                    <ChevronRight className="h-6 w-6" />
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
        <DotNav count={items.length} index={index} onSelect={go} />
      </div>

      <ul className="hidden space-y-2 md:block">
        {items.map((item) => (
          <li key={item.jobId}>
            <Link
              href={`/jobs/${item.jobId}`}
              className="flex min-h-12 items-center rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-base font-medium transition-colors hover:bg-muted/50 dark:border-gray-800 dark:hover:bg-gray-800/50"
            >
              <span className="line-clamp-1 text-foreground dark:text-gray-100">
                {item.title}
              </span>
              <span className="ml-2 shrink-0 text-muted-foreground">· View</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
