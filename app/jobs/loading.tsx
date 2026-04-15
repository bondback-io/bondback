import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function JobsLoading() {
  return (
    <PageLoadingShell className="space-y-5">
      <PrimaryPageHeaderSkeleton showMeta showFilterRow filterSlots={4} />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
      <JobCardSkeletonGrid count={10} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
    </PageLoadingShell>
  );
}
