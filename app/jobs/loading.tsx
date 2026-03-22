import { Skeleton } from "@/components/ui/skeleton";
import { JobCardSkeletonGrid } from "@/components/features/job-card-skeleton";

export default function JobsLoading() {
  return (
    <section className="page-inner space-y-6">
      {/* Title + result count */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-5 w-40" />
      </div>
      {/* Filter bar placeholder */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-full max-w-[140px]" />
        <Skeleton className="h-10 w-full max-w-[100px]" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-20" />
      </div>
      {/* Job cards grid: 6–10 cards matching final layout */}
      <JobCardSkeletonGrid count={10} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
    </section>
  );
}

