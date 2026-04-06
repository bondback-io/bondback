"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo } from "react";
import Image from "next/image";
import { Plus, Search, Star, Briefcase, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/listings";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import type { DashboardJobCardProps } from "@/components/dashboard/dashboard-job-card";
import { DashboardJobCardWithSwipe } from "@/components/dashboard/dashboard-cards-swipe";

/** Primary contextual FAB for lister/cleaner dashboards (mobile only). Sits above the tab bar; leaves room for the layout icon FAB on the right. */
export function MobileDashboardFab({
  variant,
}: {
  variant: "lister" | "cleaner";
}) {
  const router = useRouter();
  const isLister = variant === "lister";
  const href = isLister ? "/listings/new" : "/jobs";
  const label = isLister ? "Create New Listing" : "Find Jobs";

  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={() => router.prefetch(href)}
      className={cn(
        "fixed left-4 right-[4.75rem] z-[55] flex items-center justify-center gap-2 rounded-full px-4 py-3.5 text-sm font-semibold !text-white shadow-2xl transition active:scale-[0.98] no-underline hover:!text-white sm:text-base md:hidden",
        "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))]",
        isLister
          ? "bg-emerald-600 ring-2 ring-emerald-400/40 hover:bg-emerald-500 dark:bg-emerald-600 dark:!text-white dark:hover:bg-emerald-500 dark:hover:!text-white"
          : "bg-blue-600 ring-2 ring-blue-400/40 hover:bg-blue-500 dark:bg-blue-600 dark:!text-white dark:hover:bg-blue-500 dark:hover:!text-white"
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
function ResponsiveCleanerJobCardsInner({
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

export const ResponsiveCleanerJobCards = memo(ResponsiveCleanerJobCardsInner);
ResponsiveCleanerJobCards.displayName = "ResponsiveCleanerJobCards";

export type ListerActiveJobItem = {
  jobId: number;
  title: string;
  status: string;
  agreedAmountCents: number | null;
  hasEscrowPayment: boolean;
  /** e.g. "Suburb NSW 2000" */
  locationLabel: string | null;
  coverUrl: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  /** First name of assigned cleaner, if any */
  cleanerFirstName: string | null;
};

function listerActiveJobCopy(item: ListerActiveJobItem): {
  label: string;
  hint: string | null;
  badgeClass: string;
} {
  const { status, hasEscrowPayment } = item;
  if (status === "completed_pending_approval") {
    return {
      label: "Review needed",
      hint: "Cleaner marked complete — confirm to finish",
      badgeClass:
        "border-amber-400/70 bg-amber-500/15 text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/50 dark:text-amber-100",
    };
  }
  if (status === "in_progress") {
    return {
      label: "In progress",
      hint: hasEscrowPayment ? "Payment held in escrow" : null,
      badgeClass:
        "border-emerald-400/70 bg-emerald-500/15 text-emerald-950 dark:border-emerald-600/50 dark:bg-emerald-950/50 dark:text-emerald-100",
    };
  }
  if (status === "accepted") {
    if (hasEscrowPayment) {
      return {
        label: "Payment held",
        hint: "Escrow secured — job can start",
        badgeClass:
          "border-sky-400/70 bg-sky-500/15 text-sky-950 dark:border-sky-600/50 dark:bg-sky-950/50 dark:text-sky-100",
      };
    }
    return {
      label: "Awaiting payment",
      hint: "Pay on the job page to begin",
      badgeClass:
        "border-sky-400/70 bg-sky-500/15 text-sky-950 dark:border-sky-600/50 dark:bg-sky-950/50 dark:text-sky-100",
    };
  }
  return {
    label: status.replace(/_/g, " "),
    hint: null,
    badgeClass: "border-border bg-muted text-muted-foreground dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300",
  };
}

/** Lister dashboard: vertical list of active jobs (all breakpoints). */
export function ListerActiveJobsList({
  items,
}: {
  items: ListerActiveJobItem[];
}) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-3 md:space-y-2">
      {items.map((item) => {
        const { label, hint, badgeClass } = listerActiveJobCopy(item);
        const bedsBaths =
          item.bedrooms != null && item.bathrooms != null
            ? `${item.bedrooms} bed · ${item.bathrooms} bath`
            : null;

        return (
          <li key={item.jobId}>
            <Link
              href={`/jobs/${item.jobId}`}
              className={cn(
                "flex min-h-[4.5rem] gap-3 rounded-xl border border-border/70 bg-muted/15 p-3 pr-2 transition-colors",
                "hover:bg-muted/40 active:bg-muted/50",
                "dark:border-gray-800 dark:bg-gray-950/40 dark:hover:bg-gray-900/60"
              )}
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted dark:bg-gray-800">
                {item.coverUrl ? (
                  <Image
                    src={item.coverUrl}
                    alt={item.title ? `Photo for ${item.title}` : "Listing photo"}
                    fill
                    className="object-cover"
                    sizes="56px"
                    loading="lazy"
                    placeholder="blur"
                    blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-500">
                    <Briefcase className="h-6 w-6" aria-hidden />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex max-w-full rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      badgeClass
                    )}
                  >
                    {label}
                  </span>
                </div>
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground dark:text-gray-100 md:text-sm">
                  {item.title}
                </p>
                {item.locationLabel ? (
                  <p className="flex items-start gap-1 text-xs text-muted-foreground dark:text-gray-400">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 leading-snug">{item.locationLabel}</span>
                  </p>
                ) : null}
                {bedsBaths ? (
                  <p className="text-xs text-muted-foreground dark:text-gray-500">{bedsBaths}</p>
                ) : null}
                {item.agreedAmountCents != null && item.agreedAmountCents > 0 ? (
                  <p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    Agreed {formatCents(item.agreedAmountCents)}
                  </p>
                ) : null}
                {item.cleanerFirstName ? (
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    Cleaner · {item.cleanerFirstName}
                  </p>
                ) : null}
                {hint ? (
                  <p className="text-[11px] leading-snug text-muted-foreground/90 dark:text-gray-500">
                    {hint}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col items-center justify-center self-center pl-0.5">
                <ChevronRight className="h-5 w-5 text-muted-foreground dark:text-gray-500" aria-hidden />
                <span className="sr-only">Open job</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
