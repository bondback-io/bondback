import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";

export default function HelpIndexLoading() {
  return (
    <PageLoadingShell>
      <PrimaryPageHeaderSkeleton showMeta showFilterRow={false} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-12 w-full max-w-md rounded-lg" />
        <Skeleton className="h-11 w-full max-w-[140px] rounded-lg sm:w-auto" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="border-border dark:border-gray-800">
            <CardContent className="flex items-start gap-3 p-4">
              <Skeleton className="mt-0.5 h-10 w-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageLoadingShell>
  );
}
