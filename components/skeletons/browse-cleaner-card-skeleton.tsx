import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Mirrors `BrowseCleanerCard` — avatar row, title, rating strip, CTA. */
export function BrowseCleanerCardSkeleton({ className }: { className?: string }) {
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm dark:border-gray-800 dark:bg-gray-950",
        className
      )}
    >
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex gap-3">
          <Skeleton className="h-16 w-16 shrink-0 rounded-2xl" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-6 w-3/4 max-w-[14rem]" />
            <Skeleton className="h-4 w-1/2 max-w-[10rem]" />
          </div>
        </div>
        <div className="rounded-xl bg-muted/40 px-3 py-3 dark:bg-gray-900/60">
          <div className="flex justify-between gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-24 self-end" />
          </div>
        </div>
        <Skeleton className="h-11 w-full rounded-xl sm:h-10" />
      </div>
    </article>
  );
}

export function BrowseCleanerCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid min-h-0 w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <BrowseCleanerCardSkeleton key={i} />
      ))}
    </div>
  );
}
