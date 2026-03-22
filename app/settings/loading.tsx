import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonFormField,
  SkeletonToggleRow,
} from "@/components/skeletons";

export default function SettingsLoading() {
  return (
    <section className="page-inner space-y-6">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 min-w-[100px] rounded-lg shrink-0" />
        ))}
      </div>

      <Card className="border-border dark:border-gray-800">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-6">
          <SkeletonFormField />
          <SkeletonFormField />
        </CardContent>
      </Card>

      <Card className="border-border dark:border-gray-800">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3].map((i) => (
            <SkeletonToggleRow key={i} />
          ))}
        </CardContent>
      </Card>

      <Card className="border-border dark:border-gray-800">
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          <SkeletonFormField />
          <Skeleton className="h-10 w-40 rounded-md" />
        </CardContent>
      </Card>
    </section>
  );
}
