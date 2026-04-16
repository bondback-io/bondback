import { redirect } from "next/navigation";
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

export const dynamic = "force-dynamic";

type SearchParams = {
  status?: string;
  escalated?: string;
  mediation?: string;
  q?: string;
};

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

  const { data: disputedData } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, dispute_status, dispute_opened_by, dispute_reason, dispute_priority, dispute_escalated, dispute_mediation_status, mediation_proposal, proposed_refund_amount, counter_proposal_amount, created_at, updated_at")
    .in("status", ["disputed", "dispute_negotiating", "in_review", "completed_pending_approval"])
    .order("updated_at", { ascending: false });

  const allJobs = (disputedData ?? []) as any[];

  const totalOpen = allJobs.length;
  const escalatedCount = allJobs.filter((j) => Boolean(j.dispute_escalated)).length;
  const mediationCount = allJobs.filter((j) => String(j.dispute_mediation_status ?? "none") !== "none").length;

  const statusFilter = (sp.status ?? "all").toLowerCase();
  const escalatedFilter = (sp.escalated ?? "all").toLowerCase();
  const mediationFilter = (sp.mediation ?? "all").toLowerCase();
  const query = (sp.q ?? "").trim().toLowerCase();

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
      const idMatch = String(job.id).includes(query);
      const listerMatch = (lister?.full_name ?? "").toLowerCase().includes(query);
      const cleanerMatch = (cleaner?.full_name ?? "").toLowerCase().includes(query);
      const reasonMatch = reason.includes(query);
      return idMatch || listerMatch || cleanerMatch || reasonMatch;
    });
  }

  const admin = createSupabaseAdminClient();
  const byJobMessages = new Map<number, any[]>();
  if (admin && filtered.length > 0) {
    const ids = filtered.map((j) => j.id);
    const { data: msgs } = await (admin as any)
      .from("dispute_messages")
      .select("*")
      .in("job_id", ids)
      .order("created_at", { ascending: false });
    for (const m of msgs ?? []) {
      const key = Number(m.job_id);
      const arr = byJobMessages.get(key) ?? [];
      if (arr.length < 4) arr.push(m);
      byJobMessages.set(key, arr);
    }
  }

  return (
    <AdminShell activeHref="/admin/disputes">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">Dispute & Mediation Console</h1>
          <p className="text-sm text-muted-foreground dark:text-gray-400">Modern admin workflow aligned with support ticket experience.</p>
        </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">Open disputes</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">{totalOpen}</p>
          </CardContent>
        </Card>
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">Escalated</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">{escalatedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">With mediation</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">{mediationCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">Queue health</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
              {filtered.length > 0 ? "Active" : "Clear"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base dark:text-gray-100">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action="/admin/disputes"
            method="GET"
            className="grid gap-3 md:grid-cols-4"
          >
            <div className="space-y-1.5">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">Search</label>
              <Input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="job id, user, reason" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="status" className="text-xs font-medium text-muted-foreground">Status</label>
              <Input id="status" name="status" defaultValue={sp.status ?? "all"} placeholder="all / disputed / in_review" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="escalated" className="text-xs font-medium text-muted-foreground">Escalated</label>
              <Input id="escalated" name="escalated" defaultValue={sp.escalated ?? "all"} placeholder="all / yes / no" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mediation" className="text-xs font-medium text-muted-foreground">Mediation</label>
              <Input id="mediation" name="mediation" defaultValue={sp.mediation ?? "all"} placeholder="all / requested / proposed" />
            </div>
            <Button type="submit" size="sm" className="md:col-span-4 w-fit">
              Apply filters
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base md:text-lg dark:text-gray-100">Disputes queue</CardTitle>
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
                const msgPreview = byJobMessages.get(Number(job.id)) ?? [];
                return (
                  <Card key={job.id} className="border-border dark:border-gray-800 dark:bg-gray-900/60">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">Job #{job.id}</p>
                        <Badge variant="outline">{job.status}</Badge>
                        <Badge variant="secondary">{job.dispute_priority ?? "medium"}</Badge>
                        {job.dispute_escalated ? <Badge className="bg-red-600 text-white">Escalated</Badge> : null}
                        {job.dispute_mediation_status && job.dispute_mediation_status !== "none" ? (
                          <Badge className="bg-violet-600 text-white">Mediation: {job.dispute_mediation_status}</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lister?.full_name ?? "Lister"} vs {cleaner?.full_name ?? "Cleaner"} • {String(job.dispute_reason ?? "").slice(0, 180)}
                      </p>
                      {msgPreview.length ? (
                        <ul className="space-y-1 rounded-lg border border-border bg-muted/20 p-2 dark:border-gray-800">
                          {msgPreview.map((m: any) => (
                            <li key={m.id} className="text-xs text-muted-foreground">
                              {m.author_role}: {String(m.body ?? "").slice(0, 120)}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <form action={proposeMediation} className="grid gap-2 rounded-lg border border-violet-300/70 bg-violet-50/70 p-3 dark:border-violet-800 dark:bg-violet-950/20">
                        <input type="hidden" name="jobId" value={job.id} />
                        <Label className="text-xs">Mediation proposal</Label>
                        <Textarea name="proposalText" rows={2} required placeholder="Propose a fair settlement..." />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input name="refundCents" type="number" min={0} step={50} placeholder="Refund cents (optional)" />
                          <Input name="additionalPaymentCents" type="number" min={0} step={50} placeholder="Top-up cents (optional)" />
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
