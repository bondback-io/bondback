import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { SkeletonStatRow, SkeletonActivityFeed } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/** Job detail — heavy queries; show layout shell immediately. */
export default function JobDetailLoading() {
  return (
    <PageLoadingShell>
      <PrimaryPageHeaderSkeleton showFilterRow={false} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden dark:border-gray-800">
            <Skeleton className="aspect-video w-full sm:aspect-[21/9]" aria-hidden />
            <CardContent className="space-y-4 p-4 sm:p-6">
              <Skeleton className="h-7 w-3/4 max-w-md" aria-hidden />
              <Skeleton className="h-4 w-full max-w-2xl" aria-hidden />
              <Skeleton className="h-4 w-full max-w-xl" aria-hidden />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-9 w-24 rounded-full" aria-hidden />
                <Skeleton className="h-9 w-28 rounded-full" aria-hidden />
              </div>
            </CardContent>
          </Card>
          <SkeletonActivityFeed count={4} />
        </div>
        <div className="space-y-4">
          <SkeletonStatRow count={3} />
          <Skeleton className="h-12 w-full rounded-lg" aria-hidden />
        </div>
      </div>
    </PageLoadingShell>
  );
}
