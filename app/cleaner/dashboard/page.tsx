import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Badge } from "@/components/ui/badge";
import {
  QuickStatsRow,
  QuickActionsRow,
  CollapsibleActivityFeed,
  DashboardEmptyState,
  DashboardPullToRefresh,
} from "@/components/dashboard";
import { ResponsiveCleanerJobCards } from "@/components/mobile-fab";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/listings";
import {
  XCircle,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export default async function CleanerDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError || !profileData) redirect("/onboarding/role-choice");

  const profile = profileData as ProfileRow;
  const roles = (profile.roles as string[] | null) ?? [];
  if (!roles.includes("cleaner")) redirect("/dashboard");

  const { data: jobsData } = await supabase
    .from("jobs")
    .select("id, listing_id, status, created_at, updated_at, cleaner_confirmed_complete")
    .eq("winner_id", session.user.id)
    .in("status", ["accepted", "in_progress", "completed", "completed_pending_approval", "cancelled"])
    .order("created_at", { ascending: false });

  const jobs = (jobsData ?? []) as JobRow[];
  const listingIds = [...new Set(jobs.map((j) => j.listing_id))];

  let listingsMap = new Map<string, ListingRow>();
  if (listingIds.length > 0) {
    const { data: listingsData } = await supabase
      .from("listings")
      .select("*")
      .in("id", listingIds as string[]);
    (listingsData ?? []).forEach((l: unknown) => {
      const row = l as ListingRow & { id: string };
      listingsMap.set(row.id, row as ListingRow);
    });
  }

  const activeJobs = jobs.filter(
    (j) =>
      j.status === "accepted" ||
      j.status === "in_progress" ||
      j.status === "completed_pending_approval"
  );
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const cancelledJobs = jobs.filter((j) => j.status === "cancelled");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalEarningsThisMonthCents = completedJobs.reduce((sum, j) => {
    const listing = listingsMap.get(j.listing_id as string);
    const gross = listing?.current_lowest_bid_cents ?? 0;
    const jobDate = new Date(j.updated_at || j.created_at);
    return jobDate >= monthStart && jobDate <= now ? sum + gross : sum;
  }, 0);

  const cleanerAvgRaw = (profile as { cleaner_avg_rating?: number | string | null })
    .cleaner_avg_rating;
  const averageRatingValue =
    cleanerAvgRaw != null && cleanerAvgRaw !== ""
      ? Number(cleanerAvgRaw)
      : null;

  const { data: notificationsData } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const notifications = (notificationsData ?? []) as NotificationRow[];

  const stats = [
    { label: "Active Jobs", value: activeJobs.length },
    { label: "Completed Jobs", value: completedJobs.length },
    { label: "Earnings This Month", value: formatCents(totalEarningsThisMonthCents) },
    {
      label: "Average Rating",
      value:
        averageRatingValue != null && !Number.isNaN(averageRatingValue)
          ? averageRatingValue.toFixed(1)
          : "—",
    },
  ];

  const actions = [
    {
      label: "Browse Available Jobs",
      href: "/jobs",
      primary: true,
      icon: "search" as const,
    },
    { label: "My Active Jobs", href: "/cleaner/dashboard", icon: "briefcase" as const },
    { label: "My Earnings", href: "/earnings", icon: "dollar-sign" as const },
  ];

  const activityItems = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    message_text: n.message_text,
    job_id: n.job_id,
    created_at: n.created_at,
  }));

  return (
    <DashboardPullToRefresh>
    <section className="page-inner space-y-10 pb-32 sm:pb-8 md:space-y-6 md:pb-8">
      {/* Sticky title row — role switcher lives in global header on mobile */}
      <header className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:border-gray-800 dark:bg-gray-950/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground dark:text-gray-100 sm:text-xl">
            Cleaner Dashboard
          </h1>
          <Badge
            className={cn(
              "shrink-0 text-xs font-medium",
              "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
            )}
          >
            Cleaner
          </Badge>
        </div>
      </header>

      {/* Quick stats — larger type + padding on mobile; rating stays prominent */}
      <QuickStatsRow
        stats={stats}
        scrollOnMobile
        className="[&_.CardContent]:p-5 md:[&_.CardContent]:p-4 [&_p.text-xl]:text-2xl md:[&_p.text-xl]:text-xl [&_p:first-child]:text-xs md:[&_p:first-child]:text-[11px]"
      />

      {/* Quick actions — hidden on mobile when FAB is shown */}
      <div className="hidden sm:block">
        <QuickActionsRow actions={actions} />
      </div>

      {/* My Active Jobs — swipeable on mobile, grid on md+ */}
      <div className="space-y-5 md:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground dark:text-gray-100 md:text-base md:font-semibold">
            My Active Jobs
          </h2>
          {activeJobs.length > 0 && (
            <Badge variant="secondary" className="px-2.5 py-1 text-sm md:text-xs">
              {activeJobs.length} active
            </Badge>
          )}
        </div>
        {activeJobs.length === 0 ? (
          <DashboardEmptyState
            title="No active jobs"
            description="Browse available bond clean jobs and place a bid."
            actionLabel="Browse available jobs"
            actionHref="/jobs"
            icon="briefcase"
          />
        ) : (
          <ResponsiveCleanerJobCards
            ratingStars={
              averageRatingValue != null && !Number.isNaN(averageRatingValue)
                ? averageRatingValue
                : null
            }
            items={activeJobs.map((job) => {
              const listing = listingsMap.get(job.listing_id as string) ?? null;
              const moveOutRaw = listing?.move_out_date;
              const moveOut = moveOutRaw ? new Date(moveOutRaw) : null;
              const daysLeft =
                moveOut != null
                  ? Math.max(
                      0,
                      Math.ceil(
                        (moveOut.getTime() - now.getTime()) /
                          (24 * 60 * 60 * 1000)
                      )
                    )
                  : null;
              const isUrgent = daysLeft != null && daysLeft <= 1;
              return {
                job: {
                  id: job.id,
                  listing_id: String(job.listing_id),
                  status: job.status,
                  cleaner_confirmed_complete: job.cleaner_confirmed_complete,
                },
                listing,
                daysLeft,
                isUrgent,
              };
            })}
          />
        )}
      </div>

      {/* Completed jobs — vertical list */}
      <div className="rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:rounded-xl md:border">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4 dark:border-gray-800 md:px-4 md:py-3">
          <h2 className="text-xl font-bold text-foreground dark:text-gray-100 md:text-sm md:font-semibold">
            Completed Jobs
          </h2>
          {completedJobs.length > 0 && (
            <Link
              href="/earnings"
              className="min-h-10 px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline md:min-h-0 md:text-xs md:font-medium"
            >
              View all
            </Link>
          )}
        </div>
        <div className="p-4 md:p-3">
          {completedJobs.length === 0 ? (
            <p className="py-6 text-center text-base text-muted-foreground dark:text-gray-400 md:py-5 md:text-sm">
              No completed jobs yet. Finished jobs and payouts appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {completedJobs.slice(0, 5).map((job) => {
                const listing = listingsMap.get(job.listing_id as string);
                return (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/50 dark:border-gray-800 dark:hover:bg-gray-800/50 md:min-h-12"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-base font-semibold text-foreground dark:text-gray-100 md:line-clamp-1">
                          {listing?.title ?? `Job #${job.id}`}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          Completed
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-primary">View →</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Recent Activity — collapsible */}
      <CollapsibleActivityFeed
        items={activityItems}
        viewAllHref="/notifications"
        emptyMessage="Job updates and payments will appear here."
      />

      {/* Cancelled jobs — collapsible */}
      <details className="group rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:rounded-xl md:border">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 text-base font-semibold text-foreground dark:text-gray-200 md:min-h-0 md:px-4 md:py-3 md:text-sm md:font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            Cancelled jobs
            {cancelledJobs.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {cancelledJobs.length}
              </Badge>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-4 py-3 dark:border-gray-800">
          {cancelledJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              When a lister cancels a job you were assigned to, it will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {cancelledJobs.map((job) => {
                const listing = listingsMap.get(job.listing_id as string);
                const jobRow = job as { updated_at?: string | null };
                const cancelledAt = jobRow.updated_at
                  ? format(new Date(jobRow.updated_at), "d MMM yyyy")
                  : null;
                return (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm transition hover:bg-muted/50 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:bg-gray-800/70"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground dark:text-gray-100">
                          {listing?.title ?? `Job #${job.id}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                          Cancelled by lister
                          {cancelledAt && ` · ${cancelledAt}`} · Un-assigned
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary">
                        View →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>

    </section>
    </DashboardPullToRefresh>
  );
}
