import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function StripeConnectSuccessLoading() {
  return (
    <PageLoadingShell className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <Skeleton className="h-12 w-12 rounded-full" aria-hidden />
      <Skeleton className="h-5 w-56 max-w-full" aria-hidden />
      <Skeleton className="h-4 w-64 max-w-full" aria-hidden />
    </PageLoadingShell>
  );
}
