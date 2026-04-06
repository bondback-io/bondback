"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Reusable skeleton components for Bond Back. Use with Next.js loading.tsx (route-level)
 * or conditional render: if (loading) return <SkeletonGrid />; return <RealContent />;
 * - SkeletonJobCard / SkeletonJobCardGrid: job list
 * - SkeletonStatCard / SkeletonStatRow: dashboard stats (4 cards)
 * - SkeletonProfileHeader, SkeletonFormField, SkeletonPhotoGrid: profile/settings
 * - SkeletonTableRow / SkeletonTable: admin tables
 */

/** Re-export: job card skeleton matching ListingCard layout (thumbnail, title, price, badges). */
export {
  JobCardSkeleton as SkeletonJobCard,
  JobCardSkeletonGrid as SkeletonJobCardGrid,
} from "@/components/features/job-card-skeleton";

/** Rectangular stat block — same padding/border-radius as QuickStatsRow (p-4, rounded-lg). Zero CLS. */
export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-lg border border-border shadow-sm dark:border-gray-800 dark:bg-gray-900/50",
        className
      )}
    >
      <CardContent className="p-5 sm:p-4">
        <Skeleton className="h-3.5 w-24 sm:h-3 sm:w-20" aria-hidden />
        <Skeleton className="mt-3 h-8 w-16 sm:mt-2 sm:h-7 sm:w-14" aria-hidden />
      </CardContent>
    </Card>
  );
}

/** Stats row: 4 cards. Mobile-first horizontal scroll when scrollOnMobile (matches QuickStatsRow). */
export function SkeletonStatRow({
  count = 4,
  scrollOnMobile,
}: {
  count?: number;
  scrollOnMobile?: boolean;
}) {
  return (
    <div
      className={cn(
        scrollOnMobile
          ? "flex gap-3 overflow-x-auto pb-1 sm:overflow-visible sm:grid sm:grid-cols-4 sm:gap-4"
          : "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStatCard
          key={i}
          className={cn(scrollOnMobile && "min-w-[140px] shrink-0 sm:min-w-0")}
        />
      ))}
    </div>
  );
}

/** Action buttons row: same gap-2, min-w, rounded-md as QuickActionsRow. */
export function SkeletonActionRow({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-12 min-h-[48px] min-w-[140px] shrink-0 rounded-md sm:h-10 sm:min-h-0 sm:min-w-0"
          aria-hidden
        />
      ))}
    </div>
  );
}

/** Table row: avatar + text + badge + actions. Same p-3, rounded as admin Table. Zero CLS. */
export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-border dark:border-gray-800">
      <td className="p-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" aria-hidden />
      </td>
      {Array.from({ length: Math.max(0, columns - 2) }).map((_, i) => (
        <td key={i} className="p-3">
          <Skeleton className="h-4 w-full max-w-[120px] rounded-md" aria-hidden />
        </td>
      ))}
      <td className="p-3">
        <Skeleton className="h-5 w-16 rounded-full" aria-hidden />
      </td>
      <td className="p-3">
        <Skeleton className="h-8 w-20 rounded-md" aria-hidden />
      </td>
    </tr>
  );
}

/** Full table: same rounded-lg border as admin tables. 6–12 rows typical. */
export function SkeletonTable({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/50 dark:border-gray-800 dark:bg-gray-900/50">
            <th className="p-3 text-left"><Skeleton className="h-4 w-12" /></th>
            {Array.from({ length: Math.max(0, columns - 2) }).map((_, i) => (
              <th key={i} className="p-3 text-left"><Skeleton className="h-4 w-20" /></th>
            ))}
            <th className="p-3" /><th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Profile header: avatar circle + name + bio lines. Same gap/padding as profile page. Zero CLS. */
export function SkeletonProfileHeader() {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
      <Skeleton className="h-28 w-28 shrink-0 rounded-full sm:h-24 sm:w-24" aria-hidden />
      <div className="flex w-full min-w-0 flex-1 flex-col space-y-2 text-center sm:text-left">
        <Skeleton className="mx-auto h-8 w-52 max-w-full rounded-md sm:mx-0 md:h-7 md:w-48" aria-hidden />
        <Skeleton className="mx-auto h-4 w-72 max-w-full rounded-md sm:mx-0" aria-hidden />
        <Skeleton className="mx-auto h-4 w-56 max-w-full rounded-md sm:mx-0" aria-hidden />
      </div>
    </div>
  );
}

/** Form field: label + input block. Mobile-first: taller input placeholder (h-12) for touch. */
export function SkeletonFormField() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-28 rounded-md sm:w-24" aria-hidden />
      <Skeleton className="h-12 w-full rounded-md sm:h-10" aria-hidden />
    </div>
  );
}

/** Toggle row: label + switch placeholder. */
export function SkeletonToggleRow() {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 py-1 sm:min-h-0 sm:py-0">
      <div className="min-w-0 space-y-1.5 sm:space-y-1">
        <Skeleton className="h-4 w-36 sm:w-32" />
        <Skeleton className="h-3.5 w-full max-w-[12rem] sm:h-3 sm:w-48" />
      </div>
      <Skeleton className="h-7 w-12 shrink-0 rounded-full sm:h-6 sm:w-11" />
    </div>
  );
}

/** Photo/portfolio grid (e.g. 2x3 or 3x2). */
export function SkeletonPhotoGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  );
}

/** Activity feed item: icon + title + subtitle. */
export function SkeletonActivityItem() {
  return (
    <div className="flex gap-3 py-2.5 sm:py-2">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full sm:h-8 sm:w-8" />
      <div className="min-w-0 flex-1 space-y-2 sm:space-y-1">
        <Skeleton className="h-4 w-full sm:h-4" />
        <Skeleton className="h-3.5 w-24 sm:h-3 sm:w-20" />
      </div>
    </div>
  );
}

export function SkeletonActivityFeed({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonActivityItem key={i} />
      ))}
    </div>
  );
}

export {
  PrimaryPageHeaderSkeleton,
  type PrimaryPageHeaderSkeletonProps,
} from "@/components/skeletons/navigation-chrome-skeleton";

export { NewListingFormSkeleton } from "@/components/skeletons/new-listing-form-skeleton";
export { SignupWizardSkeleton } from "@/components/skeletons/signup-wizard-skeleton";

export { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
export { RootSegmentSkeleton } from "@/components/skeletons/root-segment-skeleton";
export {
  BrowseCleanerCardSkeleton,
  BrowseCleanerCardSkeletonGrid,
} from "@/components/skeletons/browse-cleaner-card-skeleton";
