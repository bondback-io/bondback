import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";
import { SkeletonStatRow, SkeletonActionRow, SkeletonActivityFeed } from "@/components/skeletons";

export default function CleanerDashboardLoading() {
  return (
    <section className="page-inner space-y-8 pb-20 sm:pb-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-48 sm:h-9 sm:w-64" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <SkeletonStatRow count={4} scrollOnMobile />
      <SkeletonActionRow count={4} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <JobCardSkeletonGrid count={6} />
      </div>

      <Card className="border-border dark:border-gray-800">
        <div className="border-b border-border px-4 py-3 dark:border-gray-800">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="p-3">
          <SkeletonActivityFeed count={5} />
        </div>
      </Card>
    </section>
  );
}
