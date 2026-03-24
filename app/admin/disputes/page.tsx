import { redirect } from "next/navigation";
import Link from "next/link";
import { startOfWeek, subDays } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DisputeRow } from "@/components/admin/dispute-row";
import { AdminShell } from "@/components/admin/admin-shell";
import { Sailboat } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = { status?: string; range?: string; q?: string };

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

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const sevenDaysAgo = subDays(now, 7);
  const thirtyDaysAgo = subDays(now, 30);

  // Fetch disputed jobs (open disputes only; resolved/rejected would need a dispute_resolution table for history)
  const { data: disputedData } = await supabase
    .from("jobs")
    .select("id, listing_id, lister_id, winner_id, status, dispute_reason, dispute_photos, dispute_evidence, dispute_status, dispute_opened_by, disputed_at, dispute_response_reason, dispute_response_evidence, proposed_refund_amount, counter_proposal_amount, payment_intent_id, refund_amount, refund_status, created_at, updated_at")
    .in("status", ["disputed", "dispute_negotiating", "in_review"])
    .order("created_at", { ascending: false });

  const allJobs = (disputedData ?? []) as any[];

  const totalOpen = allJobs.length;
  const disputesThisWeek = allJobs.filter(
    (j) => new Date(j.created_at) >= weekStart
  ).length;
  const resolvedThisMonth = 0; // Stub: would need dispute resolution log
  const avgResolutionDays = "—"; // Stub: would need resolution timestamps

  const statusFilter = (sp.status ?? "all").toLowerCase();
  const rangeFilter = sp.range ?? "all";
  const query = (sp.q ?? "").trim().toLowerCase();

  let filtered = allJobs;
  if (statusFilter === "resolved" || statusFilter === "rejected") {
    filtered = []; // No historical dispute list without resolution table
  }

  if (rangeFilter === "7") {
    filtered = filtered.filter((j) => new Date(j.created_at) >= sevenDaysAgo);
  } else if (rangeFilter === "30") {
    filtered = filtered.filter((j) => new Date(j.created_at) >= thirtyDaysAgo);
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

  const baseSearchParams = new URLSearchParams();
  if (sp.status) baseSearchParams.set("status", sp.status);
  if (sp.range) baseSearchParams.set("range", sp.range);
  if (sp.q) baseSearchParams.set("q", sp.q);

  return (
    <AdminShell activeHref="/admin/disputes">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
            Dispute overview
          </h1>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Review disputed jobs, evidence and resolve outcomes.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Total open disputes
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
              {totalOpen}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Disputes this week
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
              {disputesThisWeek}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Resolved this month
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
              {resolvedThisMonth}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Avg resolution time
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
              {avgResolutionDays === "—" ? "—" : `${avgResolutionDays} days`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base dark:text-gray-100">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action="/admin/disputes"
            method="GET"
            className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4"
          >
            <div className="flex-1 space-y-1.5">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Search (job ID, name, reason)
              </label>
              <Input
                id="q"
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Search..."
                className="max-w-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <Select name="status" defaultValue={sp.status ?? "all"}>
                <SelectTrigger id="status" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="range" className="text-xs font-medium text-muted-foreground">
                Date range
              </label>
              <Select name="range" defaultValue={sp.range ?? "all"}>
                <SelectTrigger id="range" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Table + empty state */}
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base md:text-lg dark:text-gray-100">
            Disputed jobs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center dark:border-gray-800 dark:bg-gray-800/30">
              <Sailboat className="h-12 w-12 text-muted-foreground dark:text-gray-500" aria-hidden />
              <p className="mt-3 font-medium text-foreground dark:text-gray-100">
                No open disputes – all jobs are smooth sailing!
              </p>
              <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
                When users raise disputes, they will appear here for review.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/admin/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0 hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="dark:border-gray-800">
                      <TableHead className="dark:text-gray-200">Job ID</TableHead>
                      <TableHead className="hidden lg:table-cell dark:text-gray-200">Lister</TableHead>
                      <TableHead className="hidden lg:table-cell dark:text-gray-200">Cleaner</TableHead>
                      <TableHead className="hidden md:table-cell dark:text-gray-200">Disputed by</TableHead>
                      <TableHead className="dark:text-gray-200">Proposed refund</TableHead>
                      <TableHead className="dark:text-gray-200">Reason</TableHead>
                      <TableHead className="hidden sm:table-cell dark:text-gray-200">Evidence</TableHead>
                      <TableHead className="dark:text-gray-200">Opened</TableHead>
                      <TableHead className="dark:text-gray-200">Status</TableHead>
                      <TableHead className="w-[60px] dark:text-gray-200">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((job) => (
                      <DisputeRow
                        key={job.id}
                        job={job}
                        lister={profilesMap.get(job.lister_id) ?? null}
                        cleaner={job.winner_id ? profilesMap.get(job.winner_id) ?? null : null}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile card list (visible only on small screens; table hidden there) */}
              <div className="grid gap-3 md:hidden">
                {filtered.map((job) => {
                  const lister = profilesMap.get(job.lister_id) ?? null;
                  const cleaner = job.winner_id ? profilesMap.get(job.winner_id) ?? null : null;
                  const reason = (job.dispute_reason ?? "No reason").slice(0, 80);
                  return (
                    <Card key={job.id} className="border-border dark:border-gray-800 dark:bg-gray-900/50">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Link href={`/jobs/${job.id}`} className="font-medium text-primary hover:underline">
                            Job #{job.id}
                          </Link>
                          <Badge variant="outline" className="text-[10px]">
                            {job.status === "disputed" ? "Pending" : job.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground dark:text-gray-400">
                          {lister?.full_name ?? "—"} · {cleaner?.full_name ?? "—"}
                        </p>
                        <p className="text-xs line-clamp-2 dark:text-gray-300">{reason}</p>
                        <div className="flex gap-2 pt-1">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/jobs/${job.id}`}>View</Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/messages?job=${job.id}`}>Message</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </AdminShell>
  );
}
