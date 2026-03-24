"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const sk = "bg-muted/80 dark:bg-gray-700/90";

/**
 * Skeleton for listing/job cards. Matches ListingCard layout:
 * mobile fixed thumbnail height 200px (4:3 band), desktop aspect 4:3; reduces layout shift.
 */
export function JobCardSkeleton({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md dark:border-gray-700 dark:bg-gray-950",
        className
      )}
    >
      {/* Mobile: matches JobCard hero + stacked body — larger type/CTA placeholders for small screens */}
      <div className="md:hidden">
        <div className="relative h-[200px] w-full min-h-[180px] max-h-[220px] overflow-hidden bg-muted dark:bg-gray-900">
          <Skeleton className={cn("absolute inset-0 rounded-none animate-shimmer", sk)} aria-hidden />
        </div>
        <div className="space-y-4 border-t border-border bg-card px-4 pb-6 pt-5 dark:border-gray-800 dark:bg-gray-950">
          <Skeleton className={cn("h-3.5 w-28 animate-shimmer", sk)} />
          <Skeleton className={cn("h-11 w-40 animate-shimmer", sk)} />
          <Skeleton className={cn("h-14 w-full max-w-xs rounded-xl animate-shimmer", sk)} />
          <Skeleton className={cn("h-5 w-full animate-shimmer", sk)} />
          <Skeleton className={cn("h-5 w-2/3 animate-shimmer", sk)} />
          <Skeleton className={cn("h-12 min-h-[48px] w-full rounded-xl animate-shimmer", sk)} />
          <Skeleton className={cn("h-12 min-h-[48px] w-full rounded-xl animate-shimmer", sk)} />
        </div>
      </div>
      {/* Desktop */}
      <div className="hidden md:flex md:flex-col">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted dark:bg-gray-900">
          <Skeleton className={cn("absolute inset-0 rounded-none animate-shimmer", sk)} aria-hidden />
        </div>
        <CardContent className="flex flex-1 flex-col gap-4 p-4 dark:border-t dark:border-gray-800">
          <div className="space-y-1.5">
            <Skeleton className={cn("h-5 w-4/5 animate-shimmer", sk)} />
            <Skeleton className={cn("h-3.5 w-2/3 animate-shimmer", sk)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className={cn("h-4 w-10 animate-shimmer", sk)} />
            <Skeleton className={cn("h-4 w-10 animate-shimmer", sk)} />
            <Skeleton className={cn("h-5 w-16 rounded-full animate-shimmer", sk)} />
          </div>
          <div className="flex justify-between gap-2">
            <Skeleton className={cn("h-6 w-20 animate-shimmer", sk)} />
            <Skeleton className={cn("h-4 w-16 animate-shimmer", sk)} />
          </div>
          <Skeleton className={cn("h-10 w-full rounded-lg animate-shimmer", sk)} />
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
        "grid min-h-0 w-full grid-cols-1 gap-4 sm:gap-3 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}
