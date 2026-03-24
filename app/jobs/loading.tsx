import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";

export default function JobsLoading() {
  return (
    <section className="page-inner space-y-6 sm:space-y-5">
      <PrimaryPageHeaderSkeleton showMeta showFilterRow filterSlots={4} />
      <JobCardSkeletonGrid count={10} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
    </section>
  );
}
