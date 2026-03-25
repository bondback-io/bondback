import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Brief shell while `/listings/[id]` redirects to `/jobs/[id]`.
 * Avoids a blank flash on client navigations to legacy listing URLs.
 */
export default function ListingRedirectLoading() {
  return (
    <section className="page-inner space-y-6 sm:space-y-5">
      <PrimaryPageHeaderSkeleton showFilterRow={false} />
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Skeleton className="h-4 w-40" aria-hidden />
      </div>
    </section>
  );
}
