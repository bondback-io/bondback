import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Page title + filter/tab toolbar skeleton (not the site header — root layout always renders Header).
 * Mobile-first: larger title block, min 44px filter chips, comfortable spacing.
 */
export type PrimaryPageHeaderSkeletonProps = {
  className?: string;
  /** Second line under title (e.g. result count). */
  showMeta?: boolean;
  /** Filter / sort chip row (jobs, dashboards). */
  showFilterRow?: boolean;
  filterSlots?: number;
  /** Horizontal tab pills (my-listings, settings-style). */
  showTabRow?: boolean;
  tabSlots?: number;
};

/**
 * Page title + toolbar skeleton — mobile-first spacing (roomy gaps, readable blocks).
 */
export function PrimaryPageHeaderSkeleton({
  className,
  showMeta = true,
  showFilterRow = true,
  filterSlots = 4,
  showTabRow = false,
  tabSlots = 5,
}: PrimaryPageHeaderSkeletonProps) {
  return (
    <div className={cn("space-y-5 sm:space-y-4", className)} aria-busy="true" aria-label="Loading">
      <div className="space-y-3 sm:space-y-2">
        <Skeleton className="h-10 w-[min(100%,22rem)] max-w-lg sm:h-8 sm:max-w-md" />
        {showMeta ? <Skeleton className="h-5 w-40 sm:h-5" /> : null}
      </div>
      {showFilterRow ? (
        <div className="flex flex-wrap gap-3 sm:gap-2">
          {Array.from({ length: filterSlots }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "h-12 min-h-[48px] rounded-lg sm:h-10 sm:min-h-0",
                i === 0 ? "w-full max-w-[160px] sm:max-w-[140px]" : i === 1 ? "w-full max-w-[120px] sm:max-w-[100px]" : "w-24 sm:w-20"
              )}
            />
          ))}
        </div>
      ) : null}
      {showTabRow ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:gap-2">
          {Array.from({ length: tabSlots }).map((_, i) => (
            <Skeleton key={i} className="h-11 min-h-[44px] min-w-[100px] shrink-0 rounded-lg sm:h-9 sm:min-h-0" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
