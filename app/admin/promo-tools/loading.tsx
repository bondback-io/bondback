import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AdminPromoToolsLoading() {
  return (
    <PageLoadingShell>
      <Skeleton className="h-9 w-56 max-w-full" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <Card className="border-border dark:border-gray-800">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    </PageLoadingShell>
  );
}
