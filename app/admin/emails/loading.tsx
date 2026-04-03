import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkeletonFormField, SkeletonToggleRow } from "@/components/skeletons";

export default function AdminEmailsLoading() {
  return (
    <PageLoadingShell>
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border lg:col-span-1 dark:border-gray-800">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </CardContent>
        </Card>
        <Card className="border-border lg:col-span-2 dark:border-gray-800">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            <SkeletonFormField />
            <Skeleton className="h-48 w-full rounded-md" />
            <SkeletonToggleRow />
            <Skeleton className="h-11 w-full max-w-[200px] rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </PageLoadingShell>
  );
}
