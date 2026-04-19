import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { countJobAfterPhotosFromStorage } from "@/lib/jobs/after-photo-storage-count";
import { CleanerAdditionalPaymentPageForm } from "@/components/disputes/cleaner-additional-payment-page-form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function RequestAdditionalPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = String(raw ?? "").trim();
  if (!/^\d+$/.test(id)) notFound();

  const session = await getSessionWithProfile();
  if (!session) redirect(`/login?redirectTo=/jobs/${id}/request-additional-payment`);

  const jobId = parseInt(id, 10);
  const supabase = await createServerSupabaseClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, winner_id, status")
    .eq("id", jobId)
    .maybeSingle();
  const row = job as { id?: number; winner_id?: string | null; status?: string } | null;
  if (!row) notFound();
  if (row.winner_id !== session.user.id) {
    redirect(`/jobs/${id}`);
  }
  if (
    !["in_progress", "completed_pending_approval", "disputed", "dispute_negotiating"].includes(
      String(row.status ?? "")
    )
  ) {
    redirect(`/jobs/${id}`);
  }

  const afterCount = await countJobAfterPhotosFromStorage(jobId);
  if (afterCount < 3) {
    return (
      <section className="page-inner mx-auto max-w-lg space-y-4 px-3 py-8 sm:px-4">
        <h1 className="text-xl font-semibold dark:text-gray-100">After photos required</h1>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Upload at least three after-photos on the job (stage 4) before requesting additional payment.
        </p>
        <Button asChild>
          <Link href={`/jobs/${id}`}>Back to job</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="page-inner mx-auto max-w-lg space-y-4 px-3 py-6 sm:px-4 sm:py-8">
      <CleanerAdditionalPaymentPageForm jobId={jobId} showBreadcrumbs />
    </section>
  );
}
