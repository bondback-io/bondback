import { PrimaryPageHeaderSkeleton } from "@/components/skeletons/navigation-chrome-skeleton";
import { SkeletonActivityFeed } from "@/components/skeletons";

export default function NotificationsLoading() {
  return (
    <section className="page-inner space-y-6">
      <PrimaryPageHeaderSkeleton showFilterRow={false} />
      <div className="rounded-lg border border-border bg-card/30 p-4 dark:border-gray-800">
        <SkeletonActivityFeed count={8} />
      </div>
    </section>
  );
}
