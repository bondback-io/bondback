import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { SkeletonStatRow, SkeletonTable } from "@/components/skeletons";

export default function EarningsLoading() {
  return (
    <section className="page-inner space-y-6 sm:space-y-5">
      <PrimaryPageHeaderSkeleton showFilterRow={false} />
      <SkeletonStatRow count={4} scrollOnMobile />
      <SkeletonTable rows={6} columns={4} />
    </section>
  );
}
