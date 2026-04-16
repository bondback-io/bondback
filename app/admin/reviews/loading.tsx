import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminReviewsLoading() {
  return (
    <AdminShell activeHref="/admin/reviews">
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-64 max-w-full dark:bg-gray-800" />
          <Skeleton className="mt-2 h-4 w-full max-w-xl dark:bg-gray-800" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="border-border dark:border-gray-800 dark:bg-gray-900">
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-24 dark:bg-gray-800" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 dark:bg-gray-800" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <Skeleton className="h-5 w-40 dark:bg-gray-800" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 8 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full dark:bg-gray-800" />
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
