import { redirect } from "next/navigation";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
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
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDeleteJobButton } from "@/components/admin/admin-delete-job-button";
import { adminForceCompleteJob, adminRefundJob, adminResetAllJobs, adminReinstateJob } from "@/lib/actions/admin-jobs";
import { AdminJobsPendingReviewTable } from "@/components/admin/admin-jobs-pending-review-table";
import { JOB_ADMIN_TABLE_SELECT } from "@/lib/supabase/queries";

interface AdminJobsPageProps {
  searchParams: Promise<{
    status?: string;
  }>;
}

function listingIdKey(id: string | number): string {
  return String(id);
}

export default async function AdminJobsPage({ searchParams }: AdminJobsPageProps) {
  const sp = await searchParams;
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

  if (!profileData || !(profileData as any).is_admin) {
    redirect("/dashboard");
  }

  /** Service role bypasses RLS so admin sees all jobs, listings, and profile names. */
  const db = (createSupabaseAdminClient() ?? supabase) as SupabaseClient<Database>;

  const { data: jobsData } = await db
    .from("jobs")
    .select(JOB_ADMIN_TABLE_SELECT)
    .order("created_at", { ascending: false });

  const jobs = (jobsData ?? []) as any[];

  const listingIds = Array.from(
    new Set(jobs.map((j) => j.listing_id).filter((id) => id != null))
  ) as string[];
  let listingsMap = new Map<string, { current_lowest_bid_cents: number | null }>();
  if (listingIds.length > 0) {
    const { data: listingsForJobs } = await db
      .from("listings")
      .select("id, current_lowest_bid_cents")
      .in("id", listingIds);
    (listingsForJobs ?? []).forEach((l: { id: string; current_lowest_bid_cents: number | null }) => {
      listingsMap.set(listingIdKey(l.id), { current_lowest_bid_cents: l.current_lowest_bid_cents ?? null });
    });
  }

  const listerIds = Array.from(new Set(jobs.map((j) => j.lister_id).filter(Boolean)));
  const cleanerIds = Array.from(
    new Set(jobs.map((j) => j.winner_id).filter(Boolean))
  );

  const allUserIds = Array.from(new Set([...listerIds, ...cleanerIds])) as string[];

  let profilesMap = new Map<string, { full_name: string | null }>();
  if (allUserIds.length > 0) {
    const { data: profilesForJobs } = await db.from("profiles").select("id, full_name").in("id", allUserIds);

    (profilesForJobs ?? []).forEach((p: { id: string; full_name: string | null }) => {
      profilesMap.set(p.id, { full_name: p.full_name });
    });
  }

  const selectedStatus = (sp.status ?? "").toLowerCase();

  const nowMs = Date.now();
  const pendingReviewJobs = jobs
    .filter(
      (j) =>
        String(j.status) === "completed_pending_approval" &&
        j.auto_release_at &&
        new Date(String(j.auto_release_at)).getTime() > nowMs
    )
    .map((j) => {
      const lister = j.lister_id ? profilesMap.get(j.lister_id) : null;
      const cleaner = j.winner_id ? profilesMap.get(j.winner_id) : null;
      return {
        id: j.id as number,
        listerName: lister?.full_name ?? null,
        cleanerName: cleaner?.full_name ?? null,
        completedAt: j.completed_at ?? j.cleaner_confirmed_at ?? null,
        autoReleaseAt: String(j.auto_release_at),
      };
    });

  const filteredJobs = jobs.filter((job) => {
    if (!selectedStatus) return true;
    return (job.status as string)?.toLowerCase() === selectedStatus;
  });

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "pending" || s === "accepted") {
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    }
    if (s === "in_progress" || s === "active") {
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
    }
    if (s === "completed_pending_approval") {
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    }
    if (s === "completed") {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    }
    if (s === "disputed") {
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    }
    return "bg-muted text-muted-foreground";
  };

  return (
    <AdminShell activeHref="/admin/jobs">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
            Jobs moderation
          </h1>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            View all jobs, force-complete edge cases and manage refunds (stub).
          </p>
        </div>
      </div>

      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground dark:text-gray-300">
              Filter by status:
            </span>
            <div className="flex flex-wrap gap-1">
              <a
                href="/admin/jobs"
                className={`rounded-full px-3 py-1 text-[11px] ${
                  !selectedStatus
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                }`}
              >
                All
              </a>
              {["pending", "active", "in_progress", "completed", "disputed"].map(
                (s) => (
                  <a
                    key={s}
                    href={`/admin/jobs?status=${s}`}
                    className={`rounded-full px-3 py-1 text-[11px] ${
                      selectedStatus === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                    }`}
                  >
                    {s.replace("_", " ")}
                  </a>
                )
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground dark:text-gray-300">
            Showing {filteredJobs.length} job(s).
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base md:text-lg dark:text-gray-100">
            Jobs Pending Review (48h Timer)
          </CardTitle>
          <p className="text-sm text-muted-foreground dark:text-gray-300">
            Jobs in{" "}
            <code className="rounded-md border border-border bg-muted/90 px-1.5 py-0.5 font-mono text-[13px] text-foreground dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
              completed_pending_approval
            </code>{" "}
            with an{" "}
            <code className="rounded-md border border-border bg-muted/90 px-1.5 py-0.5 font-mono text-[13px] text-foreground dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
              auto_release_at
            </code>{" "}
            in the future.
          </p>
        </CardHeader>
        <CardContent>
          <AdminJobsPendingReviewTable jobs={pendingReviewJobs} />
        </CardContent>
      </Card>

      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base md:text-lg dark:text-gray-100">
            All jobs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead className="hidden md:table-cell">Lister</TableHead>
                <TableHead className="hidden md:table-cell">Cleaner</TableHead>
                <TableHead className="text-right whitespace-nowrap">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Created
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  Completed
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => {
                const lister = profilesMap.get(job.lister_id) ?? null;
                const cleaner = profilesMap.get(job.winner_id) ?? null;

                return (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground dark:text-gray-100 sm:text-sm">
                          Job #{job.id}
                        </p>
                        <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                          Listing #{job.listing_id}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                      {lister?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                      {cleaner?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-[11px] tabular-nums text-foreground dark:text-gray-100">
                      {(() => {
                        const cents = job.listing_id
                          ? listingsMap.get(listingIdKey(job.listing_id))?.current_lowest_bid_cents
                          : null;
                        return cents != null ? `$${(cents / 100).toFixed(0)}` : "—";
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(
                          job.status
                        )}`}
                      >
                        {String(job.status).replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-[11px] text-muted-foreground">
                      {job.created_at
                        ? format(new Date(job.created_at), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-[11px] text-muted-foreground">
                      {job.completed_at
                        ? format(new Date(job.completed_at), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          asChild
                          size="xs"
                          variant="outline"
                          className="text-[11px]"
                        >
                          <a href={`/jobs/${job.id}`}>View</a>
                        </Button>
                        {String(job.status) !== "completed" ? (
                          <form action={adminForceCompleteJob}>
                            <input type="hidden" name="jobId" value={job.id} />
                            <Button
                              type="submit"
                              size="xs"
                              variant="outline"
                              className="text-[11px]"
                            >
                              Force complete
                            </Button>
                          </form>
                        ) : (
                          <form action={adminReinstateJob}>
                            <input type="hidden" name="jobId" value={job.id} />
                            <Button
                              type="submit"
                              size="xs"
                              variant="outline"
                              className="text-[11px]"
                            >
                              Re-instate
                            </Button>
                          </form>
                        )}
                        <form action={adminRefundJob}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <Button
                            type="submit"
                            size="xs"
                            variant="outline"
                            className="text-[11px]"
                          >
                            Refund (stub)
                          </Button>
                        </form>
                        <AdminDeleteJobButton jobId={job.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-sm font-semibold dark:text-gray-100">
            Dangerous: Reset all jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={adminResetAllJobs} className="space-y-3 text-xs text-muted-foreground dark:text-gray-300">
            <p>
              This will permanently delete <strong>all jobs</strong> and their messages. Listings
              will remain but will no longer be linked to jobs. This action cannot be undone.
            </p>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="confirm" className="h-3 w-3" />
              <span>I understand this cannot be undone.</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span>Type &quot;delete&quot; to confirm:</span>
              <input
                type="text"
                name="confirmText"
                className="h-7 rounded-md border border-border bg-background px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              className="mt-1"
            >
              Reset ALL Jobs
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </AdminShell>
  );
}

