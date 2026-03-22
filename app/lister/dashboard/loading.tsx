import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";
import { SkeletonStatRow, SkeletonActionRow, SkeletonActivityFeed } from "@/components/skeletons";

export default function ListerDashboardLoading() {
  return (
    <section className="page-inner space-y-8 pb-20 sm:pb-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-48 sm:h-9 sm:w-64" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <SkeletonStatRow count={4} scrollOnMobile />
      <SkeletonActionRow count={4} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <JobCardSkeletonGrid count={6} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border dark:border-gray-800 lg:col-span-1">
          <div className="border-b border-border px-4 py-3 dark:border-gray-800">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-2 p-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </Card>
        <Card className="border-border dark:border-gray-800 lg:col-span-2">
          <div className="border-b border-border px-4 py-3 dark:border-gray-800">
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="p-3">
            <SkeletonActivityFeed count={5} />
          </div>
        </Card>
      </div>
    </section>
  );
}
