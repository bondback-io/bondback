import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";

/** Matches Path 2 signup wizard layout — fast perceived load on /signup. */
export function SignupWizardSkeleton() {
  return (
    <PageLoadingShell className="mx-auto max-w-lg space-y-6 py-8">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-2xl" aria-hidden />
        <Skeleton className="h-8 w-48 max-w-full" aria-hidden />
        <Skeleton className="h-4 w-full max-w-sm" aria-hidden />
      </div>
      <Card className="border-border dark:border-gray-800">
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-40" aria-hidden />
          <Skeleton className="h-4 w-full max-w-md" aria-hidden />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" aria-hidden />
            <Skeleton className="h-12 w-full rounded-lg" aria-hidden />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" aria-hidden />
            <Skeleton className="h-12 w-full rounded-lg" aria-hidden />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" aria-hidden />
        </CardContent>
      </Card>
    </PageLoadingShell>
  );
}
