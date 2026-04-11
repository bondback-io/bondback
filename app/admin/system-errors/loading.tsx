import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSystemErrorsLoading() {
  return (
    <PageLoadingShell>
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-3xl" />
      <Skeleton className="h-48 w-full rounded-3xl" />
    </PageLoadingShell>
  );
}
