import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DisputeJobCaseSummary } from "@/components/disputes/dispute-job-case-summary";
import { DisputeThreadCard } from "@/components/disputes/dispute-thread-card";
import { MediationVoteButtons } from "@/components/disputes/mediation-vote-buttons";
import { serializeDisputeMessagesForClient } from "@/lib/disputes/serialize-dispute-messages";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/login?redirectTo=/disputes");

  const supabase = await createServerSupabaseClient();
  const userId = session.user.id;

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select(
      "id, lister_id, winner_id, status, dispute_status, dispute_priority, dispute_escalated, dispute_mediation_status, agreed_amount_cents, updated_at, disputed_at, dispute_reason, dispute_photos, dispute_evidence, dispute_opened_by, proposed_refund_amount, counter_proposal_amount"
    )
    .or(`lister_id.eq.${userId},winner_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (jobsError) {
    console.error("[disputes page] jobs query", jobsError.message);
  }

  const list = (jobs ?? []) as any[];
  const ids = list.map((j) => j.id).filter(Boolean);

  const admin = createSupabaseAdminClient();
  const messagesByJob = new Map<number, any[]>();
  const paymentReqByJob = new Map<number, any[]>();
  const mediationByJob = new Map<number, any>();
  if (admin && ids.length > 0) {
    const { data: msgs } = await (admin as any)
      .from("dispute_messages")
      .select("*")
      .in("job_id", ids)
      .order("created_at", { ascending: true });
    for (const m of msgs ?? []) {
      const key = Number(m.job_id);
      const arr = messagesByJob.get(key) ?? [];
      arr.push(m);
      messagesByJob.set(key, arr);
    }
    for (const [jid, arr] of messagesByJob) {
      messagesByJob.set(jid, serializeDisputeMessagesForClient(arr));
    }

    const { data: reqs } = await (admin as any)
      .from("cleaner_additional_payment_requests")
      .select("*")
      .in("job_id", ids)
      .order("created_at", { ascending: false });
    for (const r of reqs ?? []) {
      const key = Number(r.job_id);
      const arr = paymentReqByJob.get(key) ?? [];
      arr.push(r);
      paymentReqByJob.set(key, arr);
    }

    const { data: votes } = await (admin as any)
      .from("dispute_mediation_votes")
      .select("*")
      .in("job_id", ids)
      .order("created_at", { ascending: false });
    for (const v of votes ?? []) {
      if (!mediationByJob.has(Number(v.job_id))) mediationByJob.set(Number(v.job_id), v);
    }
  }

  return (
    <section className="page-inner mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Dispute Resolution</h1>
          <p className="text-sm text-muted-foreground">
            View threads and mediation for your jobs. Open a <strong>new</strong> dispute or request additional
            payment only from the job page after after-photos (stage 4).
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <Alert className="border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/30">
        <AlertDescription className="text-sm text-sky-950 dark:text-sky-100">
          <strong>Cleaners:</strong> use <strong>Request additional payment</strong> on the job after uploading
          after-photos. <strong>Listers / cleaners:</strong> use <strong>Raise a dispute</strong> on the job in the
          same stage — not from this page.
        </AlertDescription>
      </Alert>

      {jobsError ? (
        <Card className="border-destructive/60 dark:border-red-900">
          <CardContent className="py-6 text-sm text-destructive">
            Could not load your jobs: {jobsError.message}
          </CardContent>
        </Card>
      ) : null}

      {!jobsError && list.length === 0 ? (
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No jobs linked to your account yet. When you have an active job, dispute threads and payment updates will
            appear here.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {list.map((job) => {
          const isLister = job.lister_id === userId;
          const isCleaner = job.winner_id === userId;
          const messages = messagesByJob.get(Number(job.id)) ?? [];
          const requests = paymentReqByJob.get(Number(job.id)) ?? [];
          const latestMediation = mediationByJob.get(Number(job.id)) ?? null;
          const jobHref = `/jobs/${job.id}`;
          return (
            <Card key={job.id} className="border-border dark:border-gray-800 dark:bg-gray-900/40">
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">Job #{job.id}</CardTitle>
                    <Badge variant="outline">{job.status}</Badge>
                    <Badge variant="secondary">{job.dispute_priority ?? "medium"} priority</Badge>
                    {job.dispute_escalated ? <Badge className="bg-red-600 text-white">Escalated</Badge> : null}
                    {job.dispute_mediation_status && job.dispute_mediation_status !== "none" ? (
                      <Badge className="bg-violet-600 text-white">Mediation: {job.dispute_mediation_status}</Badge>
                    ) : null}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={jobHref}>Open job</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {requests.length > 0 ? (
                  <Card className="border-border dark:border-gray-800 dark:bg-gray-900/60">
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

                <DisputeJobCaseSummary job={job} />

                <DisputeThreadCard jobId={Number(job.id)} messages={messages} />

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
                      {(isLister || isCleaner) && <MediationVoteButtons jobId={Number(job.id)} />}
                    </CardContent>
                  </Card>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
