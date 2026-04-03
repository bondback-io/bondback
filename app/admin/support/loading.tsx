import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { SkeletonTable } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSupportLoading() {
  return (
    <PageLoadingShell>
      <div className="space-y-2">
        <Skeleton className="h-9 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <SkeletonTable rows={10} columns={5} />
    </PageLoadingShell>
  );
}
