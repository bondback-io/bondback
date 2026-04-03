import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function MyListingsLoading() {
  return (
    <PageLoadingShell className="space-y-6 pb-20 sm:space-y-5 sm:pb-8">
      <PrimaryPageHeaderSkeleton showMeta showFilterRow={false} showTabRow tabSlots={5} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-12 w-full max-w-xs rounded-lg sm:h-10" />
        <Skeleton className="h-12 min-h-[48px] w-full max-w-[200px] rounded-full sm:h-11 sm:min-h-0" />
      </div>
      <Card className="border-border p-4 dark:border-gray-800 sm:p-4">
        <JobCardSkeletonGrid count={6} className="grid-cols-1 md:grid-cols-2" />
      </Card>
    </PageLoadingShell>
  );
}
