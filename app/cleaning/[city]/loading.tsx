import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";

export default function CleaningCityLoading() {
  return (
    <PageLoadingShell>
      <PrimaryPageHeaderSkeleton showMeta showFilterRow filterSlots={3} />
      <JobCardSkeletonGrid count={6} />
    </PageLoadingShell>
  );
}
