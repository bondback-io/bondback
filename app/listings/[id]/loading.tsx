import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Brief shell while the listing detail page loads (`/listings/[id]`).
 */
export default function ListingRedirectLoading() {
  return (
    <PageLoadingShell className="space-y-6 sm:space-y-5">
      <PrimaryPageHeaderSkeleton showFilterRow={false} />
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Skeleton className="h-4 w-40" aria-hidden />
      </div>
    </PageLoadingShell>
  );
}
