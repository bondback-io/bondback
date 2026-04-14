import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import {
  SkeletonActionRow,
  SkeletonActivityFeed,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Listing detail (`/listings/[id]`) — heavy server work; show a full layout shell immediately.
 * Shaped like `app/jobs/[id]/loading.tsx` and the real listing hero / pricing / about / bid UI.
 */
export default function ListingDetailLoading() {
  return (
    <PageLoadingShell className="space-y-4 pt-1 pb-6 sm:space-y-6 sm:pt-4 sm:pb-8">
      <PrimaryPageHeaderSkeleton showFilterRow={false} />
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-4">
        <div
          className={cn(
            "xl:grid xl:items-start xl:gap-8",
            "xl:grid-cols-[minmax(0,1fr)_min(300px,32%)]"
          )}
        >
          <div className="min-w-0 space-y-4 sm:space-y-6 xl:min-h-0">
            {/* Back + optional secondary control — matches ListingAuctionDetail top row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Skeleton className="h-10 w-[7.25rem] rounded-md" aria-hidden />
              <Skeleton
                className="hidden h-10 w-36 rounded-md sm:block"
                aria-hidden
              />
            </div>

            {/* Hero + countdown strip — matches listing hero card */}
            <Card className="overflow-hidden rounded-2xl border shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="relative">
                <Skeleton
                  className="aspect-[16/10] max-h-[min(52vh,420px)] w-full rounded-none md:aspect-[21/9] md:max-h-[380px]"
                  aria-hidden
                />
                {/* Desktop/tablet: title + meta sit on hero (matches ListingAuctionDetail) */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden p-4 md:block md:p-6">
                  <div className="flex flex-wrap items-end justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-7 w-[min(100%,28rem)] max-w-xl bg-white/25 dark:bg-white/15" aria-hidden />
                      <Skeleton className="h-4 w-[min(100%,20rem)] max-w-md bg-white/20 dark:bg-white/12" aria-hidden />
                    </div>
                    <Skeleton className="h-8 w-24 shrink-0 rounded-full bg-white/20 dark:bg-white/12" aria-hidden />
                  </div>
                </div>
              </div>
              {/* Title / location / badge — mobile fallback strip under hero */}
              <div className="space-y-3 border-t border-border bg-muted/30 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/40 sm:px-4 md:hidden">
                <Skeleton className="h-6 w-[85%] max-w-xl" aria-hidden />
                <Skeleton className="h-4 w-[70%] max-w-md" aria-hidden />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-7 w-24 rounded-full" aria-hidden />
                  <Skeleton className="h-7 w-20 rounded-full" aria-hidden />
                </div>
              </div>
              {/* Time left strip — matches live countdown row */}
              <div className="border-t border-border bg-gradient-to-r from-emerald-500/5 via-card to-sky-500/5 px-4 py-4 dark:border-gray-800 dark:from-emerald-950/25 dark:to-sky-950/20 md:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 shrink-0 rounded-xl" aria-hidden />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-24" aria-hidden />
                      <Skeleton className="h-8 w-40 max-w-[12rem]" aria-hidden />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-52 max-w-full sm:ml-auto" aria-hidden />
                </div>
              </div>
            </Card>

            {/* Pricing grid — matches Current lowest / Starting / Buy now strip */}
            <Card className="overflow-hidden shadow-sm dark:border-gray-800">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 divide-y divide-border dark:divide-gray-800 md:grid-cols-3 md:divide-x md:divide-y-0">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex min-h-[5.25rem] flex-col justify-center gap-2 px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6"
                    >
                      <Skeleton className="h-3 w-32 sm:w-28" aria-hidden />
                      <Skeleton className="h-9 w-36 sm:h-10 sm:w-32" aria-hidden />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* About this listing — description */}
            <Card className="dark:border-gray-800">
              <CardHeader className="space-y-2 pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Skeleton className="h-8 w-56 max-w-[80%] md:h-9 md:w-64" aria-hidden />
                  <Skeleton className="h-7 w-16 shrink-0 rounded-full" aria-hidden />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 sm:space-y-4">
                <Skeleton className="h-4 w-full" aria-hidden />
                <Skeleton className="h-4 w-full max-w-3xl" aria-hidden />
                <Skeleton className="h-4 w-full max-w-2xl" aria-hidden />
                <Skeleton className="h-4 w-4/5 max-w-xl" aria-hidden />
              </CardContent>
            </Card>

            {/* Bid / buy actions — matches PlaceBidForm primary actions */}
            <div className="space-y-3">
              <SkeletonActionRow count={2} />
              <Skeleton className="h-11 w-full rounded-lg sm:max-w-md" aria-hidden />
            </div>

            {/* Bid history / activity — same family as job detail secondary column feed */}
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" aria-hidden />
              <Card className="dark:border-gray-800">
                <CardContent className="space-y-1 p-4 sm:p-5">
                  <SkeletonActivityFeed count={4} />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Q&A dock column (xl) — matches ListingPublicCommentsDock width */}
          <aside className="mt-6 hidden min-w-0 xl:mt-0 xl:block">
            <Card className="sticky top-24 flex h-[min(560px,70vh)] flex-col overflow-hidden border-dashed dark:border-gray-800">
              <div className="border-b border-border px-4 py-3 dark:border-gray-800">
                <Skeleton className="h-5 w-32" aria-hidden />
                <Skeleton className="mt-2 h-3 w-48" aria-hidden />
              </div>
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <SkeletonActivityFeed count={5} />
                <div className="mt-auto space-y-2 border-t border-border pt-3 dark:border-gray-800">
                  <Skeleton className="h-[72px] w-full rounded-md md:min-h-[88px]" aria-hidden />
                  <Skeleton className="h-10 w-full rounded-md" aria-hidden />
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </PageLoadingShell>
  );
}
