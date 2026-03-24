import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function FormFieldBlock() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-28 rounded-md sm:h-4" aria-hidden />
      <Skeleton className="h-12 w-full rounded-md sm:h-10" aria-hidden />
    </div>
  );
}

/**
 * Mirrors NewListingForm: step card, progress, primary fields — mobile-first (h-12 fields, roomy gaps).
 */
export function NewListingFormSkeleton() {
  return (
    <section className="page-inner space-y-6 pb-10 sm:space-y-8 sm:pb-8" aria-busy="true" aria-label="Loading form">
      <div className="space-y-4 sm:space-y-3">
        <Skeleton className="h-10 w-[min(100%,18rem)] max-w-xl sm:h-9" />
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-5 w-32 sm:h-4" />
            <Skeleton className="h-5 w-24 rounded-full sm:h-4" />
          </div>
          <Skeleton className="h-4 w-full max-w-xl rounded-full" />
        </div>
      </div>

      <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-950/50">
        <CardHeader className="space-y-2 pb-4 sm:pb-3">
          <Skeleton className="h-7 w-48 max-w-full sm:h-6" />
          <Skeleton className="h-4 w-full max-w-2xl sm:max-w-xl" />
        </CardHeader>
        <CardContent className="space-y-6 pt-0 sm:space-y-5">
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
            <FormFieldBlock />
            <FormFieldBlock />
          </div>
          <FormFieldBlock />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl sm:h-12" />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 min-h-[44px] rounded-full px-4 sm:h-10 sm:min-h-0" />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border dark:border-gray-800 dark:bg-gray-950/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-40 sm:h-5" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-12 w-full max-w-xs rounded-lg sm:h-11" />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Skeleton className="h-12 min-h-[48px] w-full rounded-full sm:h-11 sm:min-h-0 sm:max-w-[10rem]" />
        <Skeleton className="h-12 min-h-[48px] w-full rounded-full sm:h-11 sm:min-h-0 sm:max-w-[12rem]" />
      </div>
    </section>
  );
}
