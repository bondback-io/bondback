import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DISPUTE_HUB_JOB_SELECT,
  jobQualifiesForDisputeHub,
  isDisputeHubCaseClosed,
} from "@/lib/jobs/dispute-hub-helpers";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/login?redirectTo=/disputes");

  const supabase = await createServerSupabaseClient();
  const userId = session.user.id;

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select(DISPUTE_HUB_JOB_SELECT)
    .or(`lister_id.eq.${userId},winner_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .limit(150);

  if (jobsError) {
    console.error("[disputes page] jobs query", jobsError.message);
  }

  const raw = (jobs ?? []) as {
    id: number;
    title?: string | null;
    status: string;
    disputed_at?: string | null;
    dispute_status?: string | null;
    dispute_reason?: string | null;
    dispute_escalated?: boolean | null;
    dispute_mediation_status?: string | null;
    updated_at?: string | null;
    payment_released_at?: string | null;
    lister_id: string;
    winner_id: string | null;
  }[];

  const cases = raw.filter(jobQualifiesForDisputeHub).sort((a, b) => {
    const aOpen = !isDisputeHubCaseClosed(a);
    const bOpen = !isDisputeHubCaseClosed(b);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    const at = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bt - at;
  });

  const openCases = cases.filter((c) => !isDisputeHubCaseClosed(c));
  const closedCases = cases.filter((c) => isDisputeHubCaseClosed(c));

  return (
    <section className="page-inner mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Dispute Resolution</h1>
          <p className="text-sm text-muted-foreground">
            Open a <strong>new</strong> dispute from the job page. Here you can review all cases tied to your
            account — open first, then history after payment is settled.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <Alert className="border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/30">
        <AlertDescription className="text-sm text-sky-950 dark:text-sky-100">
          <strong>Cleaners:</strong> use <strong>Request additional payment</strong> on the job after uploading
          after-photos. <strong>Listers / cleaners:</strong> use <strong>Raise a dispute</strong> on the job in
          the same stage — not from this page.
        </AlertDescription>
      </Alert>

      {jobsError ? (
        <Card className="border-destructive/60 dark:border-red-900">
          <CardContent className="py-6 text-sm text-destructive">
            Could not load your jobs: {jobsError.message}
          </CardContent>
        </Card>
      ) : null}

      {!jobsError && cases.length === 0 ? (
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No dispute cases yet. When you raise a dispute on a job, it will appear in this list.
          </CardContent>
        </Card>
      ) : null}

      {!jobsError && cases.length > 0 ? (
        <div className="space-y-6">
          {openCases.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Open cases ({openCases.length})
              </h2>
              <ul className="space-y-2">
                {openCases.map((job) => (
                  <DisputeCaseListRow key={job.id} job={job} userId={userId} />
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">You have no open dispute cases.</p>
          )}

          {closedCases.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                History — closed &amp; settled ({closedCases.length})
              </h2>
              <ul className="space-y-2">
                {closedCases.map((job) => (
                  <DisputeCaseListRow key={job.id} job={job} userId={userId} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DisputeCaseListRow({
  job,
  userId,
}: {
  job: {
    id: number;
    title?: string | null;
    status: string;
    disputed_at?: string | null;
    dispute_status?: string | null;
    dispute_escalated?: boolean | null;
    dispute_mediation_status?: string | null;
    updated_at?: string | null;
    lister_id: string;
    winner_id: string | null;
  };
  userId: string;
}) {
  const closed = isDisputeHubCaseClosed(job);
  const role =
    job.lister_id === userId ? "Lister" : job.winner_id === userId ? "Cleaner" : "Party";
  const title = (typeof job.title === "string" && job.title.trim()) || `Job #${job.id}`;
  const opened =
    job.disputed_at && !Number.isNaN(new Date(job.disputed_at).getTime())
      ? new Date(job.disputed_at).toLocaleString()
      : null;
  const updated =
    job.updated_at && !Number.isNaN(new Date(job.updated_at).getTime())
      ? new Date(job.updated_at).toLocaleDateString()
      : null;

  return (
    <li>
      <Link
        href={`/disputes/${job.id}`}
        className="flex min-h-[56px] items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40 dark:border-gray-800 dark:bg-gray-900/40 dark:hover:bg-gray-800/50"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground dark:text-gray-100">Job #{job.id}</span>
            <Badge variant={closed ? "secondary" : "default"} className="text-[10px] uppercase">
              {closed ? "Closed" : "Open"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {role}
            </Badge>
            {job.dispute_escalated ? (
              <Badge className="bg-red-600 text-[10px] text-white">Escalated</Badge>
            ) : null}
            {job.dispute_mediation_status && job.dispute_mediation_status !== "none" ? (
              <Badge className="bg-violet-600 text-[10px] text-white">
                Mediation: {job.dispute_mediation_status}
              </Badge>
            ) : null}
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground dark:text-gray-400">{title}</p>
          <p className="text-[11px] text-muted-foreground dark:text-gray-500">
            {job.dispute_status ? (
              <span className="capitalize">{String(job.dispute_status).replace(/_/g, " ")}</span>
            ) : null}
            {job.dispute_status ? " · " : null}
            {opened ? <>Opened {opened}</> : null}
            {opened && updated ? " · " : null}
            {updated ? <>Updated {updated}</> : null}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
