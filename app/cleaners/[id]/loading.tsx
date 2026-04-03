import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { SkeletonStatRow, SkeletonPhotoGrid } from "@/components/skeletons";

export default function CleanerProfileLoading() {
  return (
    <PageLoadingShell className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
      </div>

      <Card className="overflow-hidden border-border dark:border-gray-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Skeleton className="mx-auto h-28 w-28 shrink-0 rounded-2xl sm:mx-0 sm:h-32 sm:w-32" />
            <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Skeleton className="h-8 w-48 max-w-full sm:h-7" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="mx-auto h-4 w-full max-w-xl sm:mx-0" />
              <Skeleton className="mx-auto h-4 w-4/5 max-w-lg sm:mx-0" />
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SkeletonStatRow count={4} scrollOnMobile />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border lg:col-span-2 dark:border-gray-800">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
        <Card className="border-border dark:border-gray-800">
          <CardHeader>
            <Skeleton className="h-6 w-28" />
          </CardHeader>
          <CardContent>
            <SkeletonPhotoGrid count={4} />
          </CardContent>
        </Card>
      </div>
    </PageLoadingShell>
  );
}
