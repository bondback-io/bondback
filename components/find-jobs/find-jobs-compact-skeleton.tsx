"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const sk = "bg-muted/75 animate-pulse dark:bg-gray-800/80";

/** Matches {@link FindJobsCompactRow} — thumb + text column for instant loading feedback. */
export function FindJobsCompactRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border-b border-border/80 bg-card/40 dark:border-gray-800 dark:bg-gray-950/30",
        className
      )}
    >
      <div className="flex gap-3 px-3 py-3 sm:px-4">
        <Skeleton className={cn("h-[72px] w-[88px] shrink-0 rounded-lg", sk)} aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className={cn("h-4 w-[min(100%,14rem)] max-w-full", sk)} aria-hidden />
            <Skeleton className={cn("h-6 w-14 shrink-0", sk)} aria-hidden />
          </div>
          <Skeleton className={cn("h-3 w-[min(100%,12rem)]", sk)} aria-hidden />
          <Skeleton className={cn("h-3 w-24", sk)} aria-hidden />
          <div className="flex flex-wrap gap-2 pt-0.5">
            <Skeleton className={cn("h-5 w-14 rounded-full", sk)} aria-hidden />
            <Skeleton className={cn("h-3 w-16", sk)} aria-hidden />
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
          <Skeleton className={cn("h-9 w-9 rounded-full", sk)} aria-hidden />
          <Skeleton className={cn("h-3 w-10", sk)} aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function FindJobsCompactRowSkeletonList({ count = 8 }: { count?: number }) {
  return (
    <div className="min-h-0 w-full" role="status" aria-label="Loading jobs">
      {Array.from({ length: count }).map((_, i) => (
        <FindJobsCompactRowSkeleton key={i} />
      ))}
    </div>
  );
}
