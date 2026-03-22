"use client";

import Link from "next/link";
import { Plus, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardJobCardProps } from "@/components/dashboard/dashboard-job-card";
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

/** Cleaner: stacked cards on small screens with tap actions on each card; grid from md up. */
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
      </div>

      {/* Tablet+ grid */}
      <div className="hidden gap-6 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-8">
        {items.map((props) => (
          <div
            key={String(props.job.id)}
            className="[&_.text-sm]:text-[15px] [&_h3]:text-base"
          >
            <DashboardJobCardWithSwipe {...props} />
          </div>
        ))}
      </div>
    </>
  );
}

/** Lister: stacked live listing cards on small screens; grid from md up. */
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
      </div>

      <div className="hidden gap-6 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-8">
        {items.map((props) => (
          <div
            key={String((props.listing as { id: string }).id)}
            className="[&_.text-sm]:text-[15px] [&_h3]:text-base"
          >
            <DashboardListingCardWithSwipe {...props} />
          </div>
        ))}
      </div>
    </>
  );
}

export type ListerActiveJobItem = {
  jobId: number;
  title: string;
  suburb?: string | null;
  postcode?: string | null;
};

/** Lister dashboard: vertical list of active jobs (all breakpoints). */
export function ListerActiveJobsList({
  items,
}: {
  items: ListerActiveJobItem[];
}) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.jobId}>
          <Link
            href={`/jobs/${item.jobId}`}
            className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted/60 dark:border-gray-800 dark:hover:bg-gray-800/50 md:min-h-12"
          >
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-base font-semibold text-foreground dark:text-gray-100 md:line-clamp-1">
                {item.title}
              </p>
              {(item.suburb || item.postcode) && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {[item.suburb, item.postcode].filter(Boolean).join(" ")}
                </p>
              )}
            </div>
            <span className="shrink-0 text-sm font-semibold text-primary">View →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
