import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";
import {
  SkeletonStatRow,
  SkeletonActionRow,
  SkeletonActivityFeed,
} from "@/components/skeletons";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";

export default function ListerDashboardLoading() {
  return (
    <PageLoadingShell className="space-y-8 pb-20 sm:space-y-7 sm:pb-8">
      <PrimaryPageHeaderSkeleton showMeta showFilterRow={false} />

      <SkeletonStatRow count={4} scrollOnMobile />
      <SkeletonActionRow count={4} />

      <div className="space-y-4 sm:space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-44 sm:h-5 sm:w-40" />
          <Skeleton className="h-6 w-14 rounded-full sm:h-5 sm:w-12" />
        </div>
        <JobCardSkeletonGrid count={6} />
      </div>

      <div className="space-y-3 sm:space-y-2">
        <Skeleton className="h-5 w-32 sm:h-4 sm:w-28" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg sm:h-10" />
          ))}
        </div>
      </div>

      <Card className="border-border dark:border-gray-800">
        <div className="border-b border-border px-4 py-4 dark:border-gray-800 sm:py-3">
          <Skeleton className="h-5 w-40 sm:h-4 sm:w-36" />
        </div>
        <div className="p-4 sm:p-3">
          <SkeletonActivityFeed count={5} />
        </div>
      </Card>
    </PageLoadingShell>
  );
}
