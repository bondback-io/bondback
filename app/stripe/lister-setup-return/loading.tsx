import { PageLoadingShell } from "@/components/skeletons/page-loading-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** Popup return — brief shell while client Stripe handler runs. */
export default function StripeListerSetupReturnLoading() {
  return (
    <PageLoadingShell className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <Skeleton className="h-10 w-10 rounded-full" aria-hidden />
      <Skeleton className="h-5 w-48 max-w-full" aria-hidden />
    </PageLoadingShell>
  );
}
