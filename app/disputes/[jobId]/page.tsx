import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DisputeJobCaseSummary } from "@/components/disputes/dispute-job-case-summary";
import { DisputeAuditTimeline } from "@/components/disputes/dispute-audit-timeline";
import { DisputeThreadCard } from "@/components/disputes/dispute-thread-card";
import { MediationVoteButtons } from "@/components/disputes/mediation-vote-buttons";
import { serializeDisputeMessagesForClient } from "@/lib/disputes/serialize-dispute-messages";
import { mergeOpeningMessageFromJobIfMissing } from "@/lib/disputes/dispute-audit-merge";
import { filterDisputeMessageRowsForPartyViewer } from "@/lib/disputes/filter-dispute-messages-for-viewer";
import {
  DISPUTE_HUB_JOB_SELECT,
  jobQualifiesForDisputeHub,
} from "@/lib/jobs/dispute-hub-helpers";

export const dynamic = "force-dynamic";

export default async function DisputeCaseDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId: jobIdParam } = await params;
  const numericId = Number(jobIdParam);
  if (!Number.isFinite(numericId) || numericId < 1) notFound();

  const session = await getSessionWithProfile();
  if (!session) redirect(`/login?redirectTo=/disputes/${numericId}`);

  const supabase = await createServerSupabaseClient();
  const userId = session.user.id;

  const { data: jobRow, error: jobError } = await supabase
    .from("jobs")
    .select(DISPUTE_HUB_JOB_SELECT)
    .eq("id", numericId)
    .maybeSingle();

  if (jobError || !jobRow) notFound();

  const job = jobRow as {
    id: number;
    lister_id: string;
    winner_id: string | null;
    title?: string | null;
  };

  if (job.lister_id !== userId && job.winner_id !== userId) notFound();
  if (!jobQualifiesForDisputeHub(jobRow as never)) redirect("/disputes");

  const isLister = job.lister_id === userId;
  const isCleaner = job.winner_id === userId;

  const admin = createSupabaseAdminClient();
  let messages = [] as ReturnType<typeof serializeDisputeMessagesForClient>;
  let requests: any[] = [];
  let latestMediation: any = null;

  if (admin) {
    const { data: msgs } = await (admin as any)
      .from("dispute_messages")
      .select("*")
      .eq("job_id", numericId)
      .order("created_at", { ascending: true });
    const raw = msgs ?? [];
    const filtered = filterDisputeMessageRowsForPartyViewer(raw, userId, {
      lister_id: job.lister_id,
      winner_id: job.winner_id,
    });
    messages = serializeDisputeMessagesForClient(filtered);

    const { data: reqs } = await (admin as any)
      .from("cleaner_additional_payment_requests")
      .select("*")
      .eq("job_id", numericId)
      .order("created_at", { ascending: false });
    requests = reqs ?? [];

    const { data: votes } = await (admin as any)
      .from("dispute_mediation_votes")
      .select("*")
      .eq("job_id", numericId)
      .order("created_at", { ascending: false });
    latestMediation = votes?.[0] ?? null;
  }

  const auditMessages = mergeOpeningMessageFromJobIfMissing(jobRow, messages);
  const jobHref = `/jobs/${job.id}`;
  const labelTitle =
    (typeof job.title === "string" && job.title.trim()) || `Job #${job.id}`;

  return (
    <section className="page-inner mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/disputes" className="font-medium text-primary hover:underline">
              Dispute Resolution
            </Link>
            <span className="px-1 text-muted-foreground/70">/</span>
            <span>Job #{job.id}</span>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{labelTitle}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/disputes">All cases</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={jobHref}>Open job</Link>
          </Button>
        </div>
      </div>

      {requests.length > 0 ? (
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Additional payment requests</CardTitle>
            <p className="text-xs text-muted-foreground">
              Accept or deny from the job or listing page (button: View request).
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {requests.map((r: any) => (
              <div key={r.id} className="rounded-lg border border-border p-3 dark:border-gray-700">
                <p className="text-sm font-medium">${(Number(r.amount_cents) / 100).toFixed(2)} requested</p>
                <p className="mt-1 text-xs text-muted-foreground">{String(r.reason ?? "")}</p>
                <p className="mt-1 text-[11px] uppercase text-muted-foreground">{r.status}</p>
                {isLister && r.status === "pending" ? (
                  <Button asChild size="sm" className="mt-2">
                    <Link href={jobHref}>View request on job</Link>
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <DisputeJobCaseSummary job={jobRow as never} />

      <DisputeAuditTimeline jobId={numericId} messages={auditMessages} />

      <DisputeThreadCard jobId={numericId} messages={messages} showMessageList={false} />

      {latestMediation ? (
        <Card className="border-violet-300/70 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20">
          <CardHeader>
            <CardTitle className="text-base">Mediation Proposal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{String(latestMediation.proposal_text ?? "")}</p>
            <p className="text-xs text-muted-foreground">
              Refund ${(Number(latestMediation.refund_cents ?? 0) / 100).toFixed(2)} • Additional payment $
              {(Number(latestMediation.additional_payment_cents ?? 0) / 100).toFixed(2)}
            </p>
            {(isLister || isCleaner) && <MediationVoteButtons jobId={numericId} />}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
