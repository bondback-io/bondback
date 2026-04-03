import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { SkeletonProfileHeader, SkeletonFormField, SkeletonToggleRow } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AdminUserDetailLoading() {
  return (
    <PageLoadingShell>
      <Skeleton className="h-4 w-32" />
      <Card className="border-border dark:border-gray-800">
        <CardContent className="p-5 sm:p-6">
          <SkeletonProfileHeader />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border dark:border-gray-800">
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent className="space-y-4">
            <SkeletonFormField />
            <SkeletonFormField />
            <SkeletonFormField />
          </CardContent>
        </Card>
        <Card className="border-border dark:border-gray-800">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <SkeletonToggleRow />
            <SkeletonToggleRow />
            <SkeletonToggleRow />
          </CardContent>
        </Card>
      </div>
    </PageLoadingShell>
  );
}
