import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";
import {
  SkeletonStatRow,
  SkeletonActionRow,
  SkeletonActivityFeed,
} from "@/components/skeletons";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";

export default function CleanerDashboardLoading() {
  return (
    <section className="page-inner space-y-8 pb-20 sm:space-y-7 sm:pb-8">
      <PrimaryPageHeaderSkeleton showMeta showFilterRow={false} />

      <SkeletonStatRow count={4} scrollOnMobile />
      <SkeletonActionRow count={4} />

      <div className="space-y-4 sm:space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-40 sm:h-5 sm:w-36" />
          <Skeleton className="h-6 w-14 rounded-full sm:h-5 sm:w-12" />
        </div>
        <JobCardSkeletonGrid count={6} />
      </div>

      <Card className="border-border dark:border-gray-800">
        <div className="border-b border-border px-4 py-4 dark:border-gray-800 sm:py-3">
          <Skeleton className="h-5 w-40 sm:h-4 sm:w-36" />
        </div>
        <div className="p-4 sm:p-3">
          <SkeletonActivityFeed count={5} />
        </div>
      </Card>
    </section>
  );
}
