import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { SkeletonTable } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AdminPaymentsLoading() {
  return (
    <PageLoadingShell>
      <div className="space-y-2">
        <Skeleton className="h-9 w-72 max-w-full sm:h-8" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg sm:h-20" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-lg sm:h-48" />
      <Card className="border-border dark:border-gray-800">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <SkeletonTable rows={5} columns={5} />
        </CardContent>
      </Card>
    </PageLoadingShell>
  );
}
