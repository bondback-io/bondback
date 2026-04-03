import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function MessagesLoading() {
  return (
    <PageLoadingShell className="space-y-6">
      <PrimaryPageHeaderSkeleton showFilterRow={false} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="space-y-2 rounded-lg border border-border bg-card/30 p-3 dark:border-gray-800">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" aria-hidden />
          ))}
        </div>
        <div className="min-h-[min(60vh,28rem)] rounded-lg border border-border bg-card/20 p-4 dark:border-gray-800">
          <Skeleton className="h-8 w-48 max-w-full" aria-hidden />
          <Skeleton className="mt-6 h-24 w-full rounded-md" aria-hidden />
          <Skeleton className="mt-4 h-24 w-full rounded-md" aria-hidden />
        </div>
      </div>
    </PageLoadingShell>
  );
}
