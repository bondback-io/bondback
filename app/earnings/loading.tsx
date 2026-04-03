import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { SkeletonStatRow, SkeletonTable } from "@/components/skeletons";

export default function EarningsLoading() {
  return (
    <PageLoadingShell>
      <PrimaryPageHeaderSkeleton showFilterRow={false} />
      <SkeletonStatRow count={4} scrollOnMobile />
      <SkeletonTable rows={6} columns={4} />
    </PageLoadingShell>
  );
}
