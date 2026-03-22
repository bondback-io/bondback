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
      <div className="relative h-[200px] w-full overflow-hidden bg-muted dark:bg-gray-800 sm:aspect-[4/3] sm:h-auto">
        <Skeleton className="absolute inset-0 rounded-none animate-shimmer" aria-hidden />
      </div>
      <CardContent className="flex flex-1 flex-col gap-4 p-5 dark:border-t dark:border-gray-800 md:p-4">
        {/* Title + subtitle */}
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-4/5 animate-shimmer" />
          <Skeleton className="h-3.5 w-2/3 animate-shimmer" />
        </div>
        {/* Badge placeholders (e.g. beds, baths, status) */}
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-4 w-10 animate-shimmer" />
          <Skeleton className="h-4 w-10 animate-shimmer" />
          <Skeleton className="h-5 w-16 rounded-full animate-shimmer" />
        </div>
        {/* Price line */}
        <div className="flex justify-between gap-2">
          <Skeleton className="h-6 w-20 animate-shimmer" />
          <Skeleton className="h-4 w-16 animate-shimmer" />
        </div>
        <div className="flex justify-between gap-2">
          <Skeleton className="h-8 w-20 animate-shimmer" />
          <Skeleton className="h-4 w-16 animate-shimmer" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full animate-shimmer" />
        <Skeleton className="h-12 w-full rounded-lg md:h-10 animate-shimmer" />
      </CardContent>
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
