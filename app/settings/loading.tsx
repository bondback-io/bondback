import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFormField, SkeletonToggleRow } from "@/components/skeletons";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";

export default function SettingsLoading() {
  return (
    <section className="page-inner space-y-6 sm:space-y-5">
      <PrimaryPageHeaderSkeleton showMeta showFilterRow={false} showTabRow tabSlots={5} />

      <Card className="border-border dark:border-gray-800">
        <CardHeader className="space-y-2 px-4 pb-2 pt-6 sm:px-6 sm:pt-6">
          <Skeleton className="h-6 w-40 sm:h-5 sm:w-32" />
          <Skeleton className="mt-2 h-4 w-full max-w-md sm:mt-1" />
        </CardHeader>
        <CardContent className="space-y-6 px-4 pb-6 sm:px-6">
          <SkeletonFormField />
          <SkeletonFormField />
        </CardContent>
      </Card>

      <Card className="border-border dark:border-gray-800">
        <CardHeader className="px-4 pt-6 sm:px-6">
          <Skeleton className="h-6 w-44 sm:h-5 sm:w-36" />
        </CardHeader>
        <CardContent className="space-y-6 px-4 pb-6 sm:px-6">
          {[1, 2, 3].map((i) => (
            <SkeletonToggleRow key={i} />
          ))}
        </CardContent>
      </Card>

      <Card className="border-border dark:border-gray-800">
        <CardHeader className="px-4 pt-6 sm:px-6">
          <Skeleton className="h-6 w-36 sm:h-5 sm:w-28" />
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
          <SkeletonFormField />
          <Skeleton className="h-12 w-full max-w-xs rounded-md sm:h-11" />
        </CardContent>
      </Card>
    </section>
  );
}
