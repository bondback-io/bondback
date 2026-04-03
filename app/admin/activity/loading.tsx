import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/skeletons";

export default function AdminActivityLoading() {
  return (
    <PageLoadingShell>
      <div className="space-y-2">
        <Skeleton className="h-9 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <SkeletonTable rows={12} columns={5} />
    </PageLoadingShell>
  );
}
