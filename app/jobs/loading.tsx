import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";

export default function JobsLoading() {
  return (
    <PageLoadingShell>
      <PrimaryPageHeaderSkeleton showMeta showFilterRow filterSlots={4} />
      <JobCardSkeletonGrid count={10} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
    </PageLoadingShell>
  );
}
