import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/skeletons";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";

export default function AdminJobsLoading() {
  return (
    <PageLoadingShell className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 md:h-9 md:w-64" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-32" />
      </div>
      <SkeletonTable rows={10} columns={5} />
    </PageLoadingShell>
  );
}
