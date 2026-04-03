import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { SkeletonFormField } from "@/components/skeletons";

export default function SupportLoading() {
  return (
    <PageLoadingShell>
      <Skeleton className="h-4 w-32" />
      <Card className="border-border dark:border-gray-800">
        <CardHeader>
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </CardHeader>
        <CardContent className="space-y-5">
          <SkeletonFormField />
          <SkeletonFormField />
          <SkeletonFormField />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-12 w-full max-w-xs rounded-lg" />
        </CardContent>
      </Card>
      <Skeleton className="mx-auto h-4 w-64 max-w-full" />
    </PageLoadingShell>
  );
}
