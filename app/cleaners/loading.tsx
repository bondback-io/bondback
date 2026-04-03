import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { BrowseCleanerCardSkeletonGrid } from "@/components/skeletons/browse-cleaner-card-skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function CleanersBrowseLoading() {
  return (
    <PageLoadingShell>
      <PrimaryPageHeaderSkeleton showMeta showFilterRow filterSlots={4} />
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 sm:mx-0 sm:flex-wrap">
        <Skeleton className="h-11 min-h-[44px] min-w-[120px] shrink-0 rounded-lg sm:h-10" />
        <Skeleton className="h-11 min-h-[44px] min-w-[100px] shrink-0 rounded-lg sm:h-10" />
        <Skeleton className="h-11 min-h-[44px] w-full max-w-[140px] shrink-0 rounded-lg sm:h-10" />
      </div>
      <BrowseCleanerCardSkeletonGrid count={6} />
    </PageLoadingShell>
  );
}
