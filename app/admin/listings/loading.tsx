import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/skeletons";

export default function AdminListingsLoading() {
  return (
    <section className="page-inner space-y-6">
      <div>
        <Skeleton className="h-8 w-48 md:h-9 md:w-64" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-full max-w-[200px]" />
        <Skeleton className="h-10 w-28" />
      </div>
      <SkeletonTable rows={10} columns={5} />
    </section>
  );
}
