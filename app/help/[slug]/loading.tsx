import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";

export default function HelpArticleLoading() {
  return (
    <PageLoadingShell>
      <Skeleton className="h-4 w-40" />
      <Card className="border-border dark:border-gray-800">
        <CardHeader className="space-y-3">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-10 w-full max-w-2xl" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className={i % 5 === 0 ? "h-5 w-full" : "h-4 w-full"} />
          ))}
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    </PageLoadingShell>
  );
}
