import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";

/** Fallback for routes without a segment `loading.tsx` — instant shell + card grid. */
export default function RootLoading() {
  return (
    <section className="page-inner space-y-6 pb-16 sm:space-y-5 sm:pb-8">
      <PrimaryPageHeaderSkeleton showMeta showFilterRow filterSlots={3} />
      <JobCardSkeletonGrid count={6} />
    </section>
  );
}
