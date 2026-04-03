import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** Legacy redirect — keep a minimal shell for the brief navigation. */
export default function MyListingsJobsLegacyLoading() {
  return (
    <PageLoadingShell className="flex min-h-[40vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
    </PageLoadingShell>
  );
}
