import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/skeletons";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";

export default function AdminDisputesLoading() {
  return (
    <PageLoadingShell className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 md:h-9 md:w-64" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border dark:border-gray-800">
            <CardContent className="p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border dark:border-gray-800">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Skeleton className="h-9 flex-1 max-w-xs" />
            <Skeleton className="h-9 w-[140px]" />
            <Skeleton className="h-9 w-[140px]" />
            <Skeleton className="h-9 w-20" />
          </div>
        </CardContent>
      </Card>

      <SkeletonTable rows={6} columns={5} />
    </PageLoadingShell>
  );
}
