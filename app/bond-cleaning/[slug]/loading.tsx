import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function BondCleaningSlugLoading() {
  return (
    <PageLoadingShell>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-12 w-full max-w-3xl" />
      <Skeleton className="h-5 w-full max-w-2xl" />
      <Card className="border-border dark:border-gray-800">
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
    </PageLoadingShell>
  );
}
