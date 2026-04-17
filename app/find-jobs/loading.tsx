import { FindJobsMapPaneSkeleton } from "@/components/find-jobs/find-jobs-map-skeleton";
import { FindJobsCompactRowSkeletonList } from "@/components/find-jobs/find-jobs-compact-skeleton";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown the moment navigation starts — matches split list + map layout (not generic job cards). */
export default function FindJobsLoading() {
  return (
    <PageLoadingShell className="flex min-h-[70dvh] flex-col gap-0 lg:flex-row lg:min-h-[calc(100dvh-7.5rem)]">
      <div className="flex min-h-0 w-full flex-1 flex-col border-border lg:w-[min(420px,36%)] lg:max-w-[440px] lg:shrink-0 lg:border-r lg:border-border/80 dark:lg:border-gray-800">
        <div className="mx-auto w-full max-w-6xl px-3 pt-2 md:px-4 md:pt-4">
          <PrimaryPageHeaderSkeleton showMeta showFilterRow filterSlots={4} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-full bg-muted/80 dark:bg-gray-700/90" />
            <Skeleton className="h-7 w-24 rounded-full bg-muted/80 dark:bg-gray-700/90" />
            <Skeleton className="h-7 w-28 rounded-full bg-muted/80 dark:bg-gray-700/90" />
            <Skeleton className="hidden h-7 w-24 rounded-full bg-muted/70 dark:bg-gray-700/80 sm:inline-flex" />
          </div>
          <div className="mt-3 hidden gap-2 sm:flex">
            <Skeleton className="h-9 w-full max-w-[200px] rounded-lg bg-muted/70 dark:bg-gray-800/90" />
            <Skeleton className="h-9 w-24 rounded-lg bg-muted/60 dark:bg-gray-800/80" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-0 pb-8 pt-4 sm:px-4 lg:px-5">
          <FindJobsCompactRowSkeletonList count={8} />
        </div>
      </div>
      <div className="hidden min-h-0 min-w-0 flex-1 flex-col lg:flex">
        <FindJobsMapPaneSkeleton className="min-h-[320px] flex-1" />
      </div>
    </PageLoadingShell>
  );
}
