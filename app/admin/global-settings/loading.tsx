import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkeletonFormField, SkeletonToggleRow } from "@/components/skeletons";

export default function AdminGlobalSettingsLoading() {
  return (
    <PageLoadingShell>
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      {[1, 2, 3].map((section) => (
        <Card key={section} className="border-border dark:border-gray-800">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <SkeletonFormField />
              <SkeletonFormField />
            </div>
            <SkeletonToggleRow />
            <SkeletonToggleRow />
            <SkeletonFormField />
          </CardContent>
        </Card>
      ))}
    </PageLoadingShell>
  );
}
