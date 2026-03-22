"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";

/**
 * Skeleton shown during pull-to-refresh on lister/cleaner dashboards.
 * Matches the loading.tsx layout so the transition is smooth.
 */
export function DashboardRefreshSkeleton() {
  return (
    <section className="page-inner space-y-6 pb-24 sm:pb-8">
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="overflow-hidden border-border dark:border-gray-800">
            <CardContent className="p-4">
              <Skeleton className="h-3 w-20 animate-pulse" />
              <Skeleton className="mt-2 h-7 w-14 sm:h-8 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 min-w-[140px] shrink-0 rounded-md sm:min-w-0 animate-pulse" />
        ))}
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40 animate-pulse" />
          <Skeleton className="h-5 w-12 rounded-full animate-pulse" />
        </div>
        <JobCardSkeletonGrid count={6} />
      </div>
      <Card className="border-border dark:border-gray-800">
        <div className="border-b border-border px-4 py-3 dark:border-gray-800">
          <Skeleton className="h-4 w-36 animate-pulse" />
        </div>
        <div className="space-y-3 p-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3 py-2">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full animate-pulse" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-full animate-pulse" />
                <Skeleton className="h-3 w-20 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
    </section>
  );
}
