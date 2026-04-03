import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonProfileHeader,
  SkeletonFormField,
  SkeletonPhotoGrid,
} from "@/components/skeletons";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";

export default function ProfileLoading() {
  return (
    <PageLoadingShell className="space-y-6 sm:space-y-5">
      <div className="flex flex-col gap-5 sm:gap-4">
        <Skeleton className="h-10 w-56 max-w-full sm:h-9 sm:w-48" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 min-h-[44px] w-28 rounded-full sm:h-9 sm:min-h-0" />
          <Skeleton className="h-11 min-h-[44px] w-28 rounded-full sm:h-9 sm:min-h-0" />
        </div>
        <Card className="max-w-xl border-border dark:border-gray-800">
          <CardContent className="space-y-3 p-5 pt-6 sm:p-6 sm:pt-4">
            <Skeleton className="h-2.5 w-full rounded-full sm:h-2" />
            <Skeleton className="h-5 w-40 sm:h-4 sm:w-32" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border dark:border-gray-800">
        <CardContent className="space-y-7 p-5 pt-7 sm:space-y-6 sm:p-6 sm:pt-6">
          <SkeletonProfileHeader />
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
            <SkeletonFormField />
            <SkeletonFormField />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 sm:h-4 sm:w-16" />
            <Skeleton className="h-28 w-full rounded-md sm:h-24" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3 sm:space-y-2">
        <Skeleton className="h-6 w-36 sm:h-5 sm:w-28" />
        <SkeletonPhotoGrid count={6} />
      </div>
    </PageLoadingShell>
  );
}
