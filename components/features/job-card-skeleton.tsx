"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeleton for listing/job cards. Matches ListingCard layout:
 * mobile fixed thumbnail height 200px (4:3 band), desktop aspect 4:3; reduces layout shift.
 */
export function JobCardSkeleton({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md dark:border-gray-800 dark:bg-gray-900",
        className
      )}
    >
      {/* Mobile: matches JobCard hero + stacked body */}
      <div className="md:hidden">
        <div className="relative h-[200px] w-full min-h-[180px] max-h-[220px] overflow-hidden bg-muted dark:bg-gray-800">
          <Skeleton className="absolute inset-0 rounded-none animate-shimmer" aria-hidden />
        </div>
        <div className="space-y-3 border-t border-border bg-card px-4 pb-5 pt-4 dark:border-gray-800 dark:bg-gray-950">
          <Skeleton className="h-3 w-24 animate-shimmer" />
          <Skeleton className="h-10 w-36 animate-shimmer" />
          <Skeleton className="h-12 w-full max-w-xs rounded-xl animate-shimmer" />
          <Skeleton className="h-5 w-full animate-shimmer" />
          <Skeleton className="h-5 w-2/3 animate-shimmer" />
          <Skeleton className="h-12 w-full rounded-xl animate-shimmer" />
          <Skeleton className="h-12 w-full rounded-xl animate-shimmer" />
        </div>
      </div>
      {/* Desktop */}
      <div className="hidden md:flex md:flex-col">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted dark:bg-gray-800">
          <Skeleton className="absolute inset-0 rounded-none animate-shimmer" aria-hidden />
        </div>
        <CardContent className="flex flex-1 flex-col gap-4 p-4 dark:border-t dark:border-gray-800">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-4/5 animate-shimmer" />
            <Skeleton className="h-3.5 w-2/3 animate-shimmer" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-4 w-10 animate-shimmer" />
            <Skeleton className="h-4 w-10 animate-shimmer" />
            <Skeleton className="h-5 w-16 rounded-full animate-shimmer" />
          </div>
          <div className="flex justify-between gap-2">
            <Skeleton className="h-6 w-20 animate-shimmer" />
            <Skeleton className="h-4 w-16 animate-shimmer" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg animate-shimmer" />
        </CardContent>
      </div>
    </Card>
  );
}

/** Grid of job card skeletons (6–12 for lists). Same gap-3 as JobsList grid. Zero CLS. */
export function JobCardSkeletonGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
        "min-h-0 w-full",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}
