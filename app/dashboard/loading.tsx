import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <section className="page-inner space-y-6 sm:space-y-5">
      {/* Welcome bar skeleton */}
      <Card className="overflow-hidden border-border dark:border-gray-800">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-6 sm:gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="space-y-3 sm:space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-10 w-56 max-w-full sm:h-8 md:h-9 md:w-72" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-2.5 w-28 sm:h-2 sm:w-32" />
                  <Skeleton className="h-4 w-24 sm:w-20" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg sm:h-20" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions skeleton */}
      <div className="flex gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 min-w-[260px] shrink-0 rounded-lg sm:h-28 sm:min-w-0" />
        ))}
      </div>

      {/* Active jobs / main content skeleton */}
      <Card className="border-border dark:border-gray-800">
        <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-7 w-40 sm:h-6 sm:w-32" />
            <Skeleton className="h-6 w-16 rounded-full sm:h-5" />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-5 sm:px-6 sm:pb-6">
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-lg border border-border dark:border-gray-800">
                <Skeleton className="aspect-[16/10] w-full" />
                <div className="space-y-2.5 p-4 sm:space-y-2 sm:p-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-11 w-full rounded-md sm:h-9" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent activity skeleton */}
      <Card className="border-border dark:border-gray-800">
        <CardHeader>
          <Skeleton className="h-6 w-36" />
        </CardHeader>
        <CardContent>
          <ul className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-start gap-3 border-b border-border py-3.5 last:border-0 dark:border-gray-800 sm:py-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full sm:h-9 sm:w-9" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3.5 w-28 sm:h-3 sm:w-24" />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Earnings skeleton */}
      <Card className="border-border dark:border-gray-800">
        <CardHeader>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
          <Skeleton className="h-48 w-full rounded-lg" />
        </CardContent>
      </Card>
    </section>
  );
}
