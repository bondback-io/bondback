import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";

/**
 * Neutral fallback for `app/loading.tsx` — works for home, auth-adjacent routes, and any segment
 * without its own `loading.tsx` (avoids misleading job-card grids on non-list pages).
 */
export function RootSegmentSkeleton() {
  return (
    <PageLoadingShell className="space-y-8">
      <div className="space-y-4 rounded-2xl border border-border/60 bg-gradient-to-b from-emerald-50/50 via-background/80 to-transparent p-6 dark:border-gray-700/50 dark:from-emerald-950/25 dark:via-gray-950/80 dark:to-transparent sm:p-8">
        <Skeleton className="mx-auto h-7 w-52 max-w-full rounded-full sm:h-6" />
        <Skeleton className="mx-auto h-11 w-full max-w-xl sm:h-10" />
        <Skeleton className="mx-auto h-11 w-full max-w-lg sm:h-9" />
        <Skeleton className="mx-auto h-5 w-full max-w-2xl sm:h-4" />
        <div className="mx-auto mt-4 flex max-w-lg flex-col gap-3 sm:flex-row sm:justify-center">
          <Skeleton className="h-14 min-h-[52px] w-full rounded-xl sm:h-12 sm:max-w-[220px]" />
          <Skeleton className="h-14 min-h-[52px] w-full rounded-xl sm:h-12 sm:max-w-[220px]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl sm:h-24" />
        ))}
      </div>
      <Skeleton className="h-36 w-full rounded-xl sm:h-32" />
    </PageLoadingShell>
  );
}
