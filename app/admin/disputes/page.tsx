import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { proposeMediation } from "@/lib/actions/disputes";
import { DisputeJobCaseSummary } from "@/components/disputes/dispute-job-case-summary";
import { DisputeAuditTimeline } from "@/components/disputes/dispute-audit-timeline";
import { serializeDisputeMessagesForClient } from "@/lib/disputes/serialize-dispute-messages";
import { mergeOpeningMessageFromJobIfMissing } from "@/lib/disputes/dispute-audit-merge";
import { AdminDisputePartyEmailForms } from "@/components/admin/admin-dispute-party-email-forms";
import { AdminDisputeResolvePanel } from "@/components/admin/admin-dispute-resolve-panel";
import { AdminDisputeCaseNoteForm } from "@/components/admin/admin-dispute-case-note-form";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const JOB_SELECT =
  "id, lister_id, winner_id, status, dispute_status, dispute_opened_by, dispute_reason, dispute_priority, dispute_escalated, dispute_mediation_status, mediation_proposal, proposed_refund_amount, counter_proposal_amount, created_at, updated_at, disputed_at, dispute_photos, dispute_evidence, agreed_amount_cents, admin_mediation_requested, admin_mediation_requested_at, dispute_cleaner_counter_used, dispute_lister_counter_used, dispute_resolution, resolution_at";

const ACTIVE_STATUSES = ["disputed", "dispute_negotiating", "in_review", "completed_pending_approval"] as const;
const CLOSED_STATUSES = ["completed", "cancelled"] as const;

type SearchParams = {
  queue?: string;
  status?: string;
  escalated?: string;
  mediation?: string;
  dispute_status?: string;
  priority?: string;
  admin_help?: string;
  q?: string;
};

function selectClassName() {
  return cn(
    "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
  );
}

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profileData || !(profileData as { is_admin?: boolean }).is_admin) {
    redirect("/dashboard");
  }

  const queue = (sp.queue ?? "active").toLowerCase();
  const statusFilter = (sp.status ?? "all").toLowerCase();
  const escalatedFilter = (sp.escalated ?? "all").toLowerCase();
  const mediationFilter = (sp.mediation ?? "all").toLowerCase();
  const disputeStatusFilter = (sp.dispute_status ?? "all").toLowerCase();
  const priorityFilter = (sp.priority ?? "all").toLowerCase();
  const adminHelpFilter = (sp.admin_help ?? "all").toLowerCase();
  const query = (sp.q ?? "").trim().toLowerCase();

  let disputedQuery = supabase
    .from("jobs")
    .select(JOB_SELECT)
    .not("disputed_at", "is", null)
    .order("updated_at", { ascending: false })
    .limit(300);

  if (queue === "closed") {
    disputedQuery = disputedQuery.in("status", [...CLOSED_STATUSES]);
  } else if (queue === "all") {
    // any job that has dispute history
  } else {
    disputedQuery = disputedQuery.in("status", [...ACTIVE_STATUSES]);
  }

  const { data: disputedData } = await disputedQuery;

  const cdb = (createSupabaseAdminClient() ?? supabase) as any;

  const [{ count: activeCount }, { count: closedCount }, { count: allDisputeCount }] = await Promise.all([
    cdb
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .not("disputed_at", "is", null)
      .in("status", [...ACTIVE_STATUSES]),
    cdb
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .not("disputed_at", "is", null)
      .in("status", [...CLOSED_STATUSES]),
    cdb.from("jobs").select("id", { count: "exact", head: true }).not("disputed_at", "is", null),
  ]);

  const allJobs = (disputedData ?? []) as any[];

  let filtered = allJobs;
  if (statusFilter !== "all") {
    filtered = filtered.filter((j) => String(j.status).toLowerCase() === statusFilter);
  }
  if (escalatedFilter !== "all") {
    const target = escalatedFilter === "yes";
    filtered = filtered.filter((j) => Boolean(j.dispute_escalated) === target);
  }
  if (mediationFilter !== "all") {
    filtered = filtered.filter((j) => String(j.dispute_mediation_status ?? "none") === mediationFilter);
  }
  if (disputeStatusFilter !== "all") {
    filtered = filtered.filter(
      (j) => String(j.dispute_status ?? "").toLowerCase() === disputeStatusFilter
    );
  }
  if (priorityFilter !== "all") {
    filtered = filtered.filter(
      (j) => String(j.dispute_priority ?? "medium").toLowerCase() === priorityFilter
    );
  }
  if (adminHelpFilter !== "all") {
    const want = adminHelpFilter === "yes";
    filtered = filtered.filter((j) => Boolean(j.admin_mediation_requested) === want);
  }

  const userIds = Array.from(
    new Set([
      ...filtered.map((j) => j.lister_id).filter(Boolean),
      ...filtered.map((j) => j.winner_id).filter(Boolean),
    ])
  ) as string[];

  let profilesMap = new Map<
    string,
    { full_name: string | null; profile_photo_url: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, profile_photo_url")
      .in("id", userIds);

    (profiles ?? []).forEach((p: any) => {
      profilesMap.set(p.id, {
        full_name: p.full_name,
        profile_photo_url: p.profile_photo_url,
      });
    });
  }

  if (query) {
    filtered = filtered.filter((job) => {
      const lister = profilesMap.get(job.lister_id);
      const cleaner = profilesMap.get(job.winner_id);
      const reason = (job.dispute_reason ?? "").toLowerCase();
      const reso = String(job.dispute_resolution ?? "").toLowerCase();
      const idMatch = String(job.id).includes(query);
      const listerMatch = (lister?.full_name ?? "").toLowerCase().includes(query);
      const cleanerMatch = (cleaner?.full_name ?? "").toLowerCase().includes(query);
      const reasonMatch = reason.includes(query);
      const resolutionMatch = reso.includes(query);
      return idMatch || listerMatch || cleanerMatch || reasonMatch || resolutionMatch;
    });
  }

  const admin = createSupabaseAdminClient();
  const byJobMessages = new Map<number, ReturnType<typeof serializeDisputeMessagesForClient>>();
  if (admin && filtered.length > 0) {
    const ids = filtered.map((j) => j.id);
    const { data: msgs } = await (admin as any)
      .from("dispute_messages")
      .select("*")
      .in("job_id", ids)
      .order("created_at", { ascending: true });
    const rawByJob = new Map<number, any[]>();
    for (const m of msgs ?? []) {
      const key = Number(m.job_id);
      const arr = rawByJob.get(key) ?? [];
      arr.push(m);
      rawByJob.set(key, arr);
    }
    for (const [jid, arr] of rawByJob) {
      byJobMessages.set(jid, serializeDisputeMessagesForClient(arr));
    }
  }

  const filterQs = new URLSearchParams();
  if (sp.queue) filterQs.set("queue", sp.queue);
  if (sp.status && sp.status !== "all") filterQs.set("status", sp.status);
  if (sp.escalated && sp.escalated !== "all") filterQs.set("escalated", sp.escalated);
  if (sp.mediation && sp.mediation !== "all") filterQs.set("mediation", sp.mediation);
  if (sp.dispute_status && sp.dispute_status !== "all") filterQs.set("dispute_status", sp.dispute_status);
  if (sp.priority && sp.priority !== "all") filterQs.set("priority", sp.priority);
  if (sp.admin_help && sp.admin_help !== "all") filterQs.set("admin_help", sp.admin_help);
  if (sp.q) filterQs.set("q", sp.q);

  return (
    <AdminShell activeHref="/admin/disputes">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
              Dispute &amp; Mediation Console
            </h1>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Filter by queue and status, resolve escrow outcomes, and message parties. Audit trail updates
              automatically.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/disputes">Reset all filters</Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                Active dispute jobs
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
                {activeCount ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                Closed (completed / cancelled)
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
                {closedCount ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                Ever disputed
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
                {allDisputeCount ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                Matching filters
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
                {filtered.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base dark:text-gray-100">Search &amp; filters</CardTitle>
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              Choose a queue first (active vs closed), then narrow by job status, mediation flags, and free-text
              search.
            </p>
          </CardHeader>
          <CardContent>
            <form action="/admin/disputes" method="GET" className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="space-y-1.5">
                <label htmlFor="queue" className="text-xs font-medium text-muted-foreground">
                  Queue
                </label>
                <select
                  id="queue"
                  name="queue"
                  defaultValue={sp.queue ?? "active"}
                  className={selectClassName()}
                >
                  <option value="active">Active (needs attention)</option>
                  <option value="closed">Closed / resolved jobs</option>
                  <option value="all">All jobs with dispute history</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                  Search
                </label>
                <Input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Job id, names, reason, resolution…" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
                  Job status
                </label>
                <select id="status" name="status" defaultValue={sp.status ?? "all"} className={selectClassName()}>
                  <option value="all">All statuses</option>
                  <option value="disputed">disputed</option>
                  <option value="dispute_negotiating">dispute_negotiating</option>
                  <option value="in_review">in_review</option>
                  <option value="completed_pending_approval">completed_pending_approval</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="dispute_status" className="text-xs font-medium text-muted-foreground">
                  Dispute status (column)
                </label>
                <select
                  id="dispute_status"
                  name="dispute_status"
                  defaultValue={sp.dispute_status ?? "all"}
                  className={selectClassName()}
                >
                  <option value="all">All</option>
                  <option value="disputed">disputed</option>
                  <option value="in_review">in_review</option>
                  <option value="completed">completed</option>
                  <option value="resolved">resolved</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="priority" className="text-xs font-medium text-muted-foreground">
                  Priority
                </label>
                <select id="priority" name="priority" defaultValue={sp.priority ?? "all"} className={selectClassName()}>
                  <option value="all">All</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="escalated" className="text-xs font-medium text-muted-foreground">
                  Escalated
                </label>
                <select
                  id="escalated"
                  name="escalated"
                  defaultValue={sp.escalated ?? "all"}
                  className={selectClassName()}
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="mediation" className="text-xs font-medium text-muted-foreground">
                  Mediation state
                </label>
                <select
                  id="mediation"
                  name="mediation"
                  defaultValue={sp.mediation ?? "all"}
                  className={selectClassName()}
                >
                  <option value="all">All</option>
                  <option value="none">none</option>
                  <option value="requested">requested</option>
                  <option value="proposed">proposed</option>
                  <option value="accepted">accepted</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="admin_help" className="text-xs font-medium text-muted-foreground">
                  Lister asked admin help
                </label>
                <select
                  id="admin_help"
                  name="admin_help"
                  defaultValue={sp.admin_help ?? "all"}
                  className={selectClassName()}
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="flex items-end md:col-span-2 lg:col-span-3 xl:col-span-4">
                <Button type="submit" size="sm">
                  Apply filters
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base md:text-lg dark:text-gray-100">Disputes queue</CardTitle>
            <p className="text-xs text-muted-foreground">
              Queue: <strong className="text-foreground dark:text-gray-200">{queue}</strong>
              {filterQs.toString() ? (
                <>
                  {" "}
                  ·{" "}
                  <Link className="underline hover:text-foreground" href={`/admin/disputes?${filterQs.toString()}`}>
                    Bookmark this view
                  </Link>
                </>
              ) : null}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 py-10 text-center text-sm text-muted-foreground dark:border-gray-800 dark:bg-gray-800/30">
                No disputes match this filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((job) => {
                  const lister = profilesMap.get(job.lister_id);
                  const cleaner = profilesMap.get(job.winner_id);
                  const auditMessages = mergeOpeningMessageFromJobIfMissing(
                    job,
                    byJobMessages.get(Number(job.id)) ?? []
                  );
                  const suggestedRefund =
                    Math.max(0, Number(job.counter_proposal_amount ?? 0)) ||
                    Math.max(0, Number(job.proposed_refund_amount ?? 0));
                  const agreed = Math.max(0, Number(job.agreed_amount_cents ?? 0));
                  return (
                    <Card key={job.id} className="border-border dark:border-gray-800 dark:bg-gray-900/60">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">Job #{job.id}</p>
                          <Badge variant="outline">{job.status}</Badge>
                          {job.dispute_status ? (
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              dispute: {String(job.dispute_status).replace(/_/g, " ")}
                            </Badge>
                          ) : null}
                          <Badge variant="secondary">{job.dispute_priority ?? "medium"}</Badge>
                          {job.dispute_escalated ? <Badge className="bg-red-600 text-white">Escalated</Badge> : null}
                          {job.dispute_mediation_status && job.dispute_mediation_status !== "none" ? (
                            <Badge className="bg-violet-600 text-white">Mediation: {job.dispute_mediation_status}</Badge>
                          ) : null}
                          {job.dispute_resolution ? (
                            <Badge className="border border-emerald-600/50 bg-emerald-950/40 text-emerald-100">
                              Outcome: {String(job.dispute_resolution).replace(/_/g, " ")}
                            </Badge>
                          ) : null}
                          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                            <Link href={`/jobs/${job.id}#dispute`} target="_blank" rel="noopener noreferrer">
                              Open job
                            </Link>
                          </Button>
                        </div>
                        {job.resolution_at ? (
                          <p className="text-[11px] text-muted-foreground">
                            Resolution recorded: {new Date(job.resolution_at).toLocaleString()}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {lister?.full_name ?? "Lister"} vs {cleaner?.full_name ?? "Cleaner"}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`admin-med-${job.id}`}
                              checked={Boolean(job.admin_mediation_requested)}
                              disabled
                              aria-readonly
                            />
                            <Label htmlFor={`admin-med-${job.id}`} className="text-xs font-normal cursor-default">
                              Admin mediation requested
                            </Label>
                          </div>
                          {job.admin_mediation_requested_at ? (
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {new Date(job.admin_mediation_requested_at).toLocaleString()}
                            </span>
                          ) : null}
                          {job.dispute_cleaner_counter_used ? (
                            <Badge variant="outline" className="text-[10px]">
                              Cleaner counter used
                            </Badge>
                          ) : null}
                          {job.dispute_lister_counter_used ? (
                            <Badge variant="outline" className="text-[10px]">
                              Lister counter used
                            </Badge>
                          ) : null}
                        </div>

                        <DisputeJobCaseSummary job={job} />
                        <AdminDisputeCaseNoteForm jobId={Number(job.id)} />
                        <DisputeAuditTimeline
                          jobId={Number(job.id)}
                          messages={auditMessages}
                          isAdminConsole
                        />

                        <AdminDisputeResolvePanel
                          jobId={Number(job.id)}
                          jobStatus={String(job.status)}
                          suggestedRefundCents={suggestedRefund}
                          agreedAmountCents={agreed}
                        />

                        <AdminDisputePartyEmailForms jobId={Number(job.id)} />

                        <form
                          action={proposeMediation}
                          className="grid gap-2 rounded-lg border border-violet-300/70 bg-violet-50/70 p-3 dark:border-violet-800 dark:bg-violet-950/20"
                        >
                          <input type="hidden" name="jobId" value={job.id} />
                          <Label className="text-xs">Mediation proposal</Label>
                          <Textarea name="proposalText" rows={2} required placeholder="Propose a fair settlement..." />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input name="refundCents" type="number" min={0} step={50} placeholder="Refund cents (optional)" />
                            <Input
                              name="additionalPaymentCents"
                              type="number"
                              min={0}
                              step={50}
                              placeholder="Top-up cents (optional)"
                            />
                          </div>
                          <Button type="submit" size="sm" className="w-fit">
                            Send mediation proposal
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
