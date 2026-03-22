import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonProfileHeader,
  SkeletonFormField,
  SkeletonPhotoGrid,
} from "@/components/skeletons";

export default function ProfileLoading() {
  return (
    <section className="page-inner space-y-6">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        <Card className="max-w-xl border-border dark:border-gray-800">
          <CardContent className="space-y-2 pt-4">
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border dark:border-gray-800">
        <CardContent className="space-y-6 pt-6">
          <SkeletonProfileHeader />
          <div className="grid gap-6 sm:grid-cols-2">
            <SkeletonFormField />
            <SkeletonFormField />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <SkeletonPhotoGrid count={6} />
      </div>
    </section>
  );
}
