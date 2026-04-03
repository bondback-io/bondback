import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";

export default function AdminDashboardLoading() {
  return (
    <PageLoadingShell className="space-y-6">
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="pb-3">
          <Skeleton className="h-7 w-48 dark:bg-gray-800" />
          <Skeleton className="mt-2 h-4 w-72 dark:bg-gray-800" />
        </CardHeader>
        <CardContent />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card
            key={i}
            className="border-border dark:border-gray-800 dark:bg-gray-900/80"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-5 w-20 dark:bg-gray-800" />
                <Skeleton className="h-5 w-20 rounded-full dark:bg-gray-800" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full dark:bg-gray-800" />
              <Skeleton className="h-8 w-full rounded-md dark:bg-gray-800" />
            </CardContent>
          </Card>
        ))}
      </div>
    </PageLoadingShell>
  );
}
