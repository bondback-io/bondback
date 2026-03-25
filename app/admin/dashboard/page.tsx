import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminBackupButton } from "@/components/admin/admin-backup-button";
import { AdminExportDataButton } from "@/components/admin/admin-export-data-button";
import {
  AdminRevenueChart,
  type AdminRevenuePoint,
  type AdminRevenueSummary,
} from "@/components/admin/admin-revenue-chart";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSendTestNotificationButton } from "@/components/admin/admin-send-test-notification-button";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getEffectivePayoutSchedule } from "@/lib/payout-schedule";
import {
  AlertTriangle,
  Briefcase,
  DollarSign,
  List as ListIcon,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

const PLATFORM_FEE_RATE = 0.12;

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, full_name, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = profileData as ProfileRow | null;
  if (!profile || !profile.is_admin) {
    redirect("/dashboard");
  }

  return { profile, supabase };
}

async function getAdminDashboardData() {
  const { supabase, profile } = await requireAdmin();
  const admin = createSupabaseAdminClient();

  try {
    let totalUsers = 0;
    if (admin) {
      const { data, error } = await (admin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      }) as Promise<{ data: { users: any[]; total: number } | null; error: any }>);
      if (!error && data) {
        totalUsers = data.total ?? data.users.length ?? 0;
      }
    }
    if (!admin) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      totalUsers = count ?? 0;
    }

    const [{ count: activeListingsCount }, { data: jobsData }, { count: openDisputesCount }] =
      await Promise.all([
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "live"),
        supabase
          .from("jobs")
          .select("id, listing_id, status", { count: "exact" })
          .order("created_at", { ascending: false }),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .in("status", ["disputed", "in_review"]),
      ]);

    const jobs = (jobsData ?? []) as JobRow[];
    const activeJobsCount = jobs.filter((j) =>
      ["accepted", "in_progress", "completed_pending_approval"].includes(j.status as string)
    ).length;
    const completedJobs = jobs.filter((j) => j.status === "completed");
    const completedJobsCount = completedJobs.length;

    const listingIds = [...new Set(completedJobs.map((j) => j.listing_id))];
    const listingsMap = new Map<string, ListingRow>();
    if (listingIds.length > 0) {
      const { data: listingsData } = await supabase
        .from("listings")
        .select("id, current_lowest_bid_cents")
        .in("id", listingIds as any);
      (listingsData ?? []).forEach((l: any) => {
        listingsMap.set(l.id, l as ListingRow);
      });
    }

    const totalGrossCents = completedJobs.reduce((sum, job) => {
      const listing = listingsMap.get(job.listing_id as string);
      return sum + (listing?.current_lowest_bid_cents ?? 0);
    }, 0);
    const totalRevenueCents = Math.round(totalGrossCents * PLATFORM_FEE_RATE);

    const pendingPayoutsCents = 0;

    const monthlyMap = new Map<
      string,
      {
        feeCents: number;
        grossCents: number;
      }
    >();

    for (const job of completedJobs) {
      const listing = listingsMap.get(job.listing_id as string);
      const gross = listing?.current_lowest_bid_cents ?? 0;
      if (gross <= 0) continue;
      const fee = Math.round(gross * PLATFORM_FEE_RATE);
      const when = new Date((job as any).updated_at || job.created_at);
      const key = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}`;
      const prev = monthlyMap.get(key) ?? { feeCents: 0, grossCents: 0 };
      monthlyMap.set(key, {
        feeCents: prev.feeCents + fee,
        grossCents: prev.grossCents + gross,
      });
    }

    const revenuePoints: AdminRevenuePoint[] = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([monthKey, value]) => ({
        monthKey,
        date: `${monthKey}-01`,
        feeCents: value.feeCents,
        grossCents: value.grossCents,
      }));

    const averageMonthlyFeeCents =
      revenuePoints.length > 0 ? Math.round(totalRevenueCents / revenuePoints.length) : 0;

    let growthPercent = 0;
    if (revenuePoints.length >= 2) {
      const last = revenuePoints.at(-1)?.feeCents;
      const prev = revenuePoints.at(-2)?.feeCents;
      if (prev != null && last != null && prev > 0) {
        growthPercent = ((last - prev) / prev) * 100;
      }
    }

    const revenueSummary: AdminRevenueSummary | null = {
      totalRevenueCents,
      averageMonthlyFeeCents,
      growthPercent,
    };

    const { data: notificationsData } = await supabase
      .from("notifications")
      .select("id, user_id, type, job_id, message_text, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const notifications = (notificationsData ?? []) as NotificationRow[];
    const userIds = [...new Set(notifications.map((n) => n.user_id))];
    const userNames = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds as any);
      (profilesData ?? []).forEach((p: any) => {
        userNames.set(p.id, (p.full_name as string | null) || "User");
      });
    }

    const globalSettings = await getGlobalSettings();
    const platformPayout = (globalSettings?.payout_schedule as "daily" | "weekly" | "monthly") ?? "weekly";
    const winnerIds = [...new Set(completedJobs.map((j) => (j as { winner_id?: string | null }).winner_id).filter(Boolean))] as string[];
    const profilesByWinner = new Map<string, string>();
    if (winnerIds.length > 0 && admin) {
      const { data: winnerProfiles } = await admin
        .from("profiles")
        .select("id, preferred_payout_schedule")
        .in("id", winnerIds);
      for (const row of winnerProfiles ?? []) {
        const p = row as Pick<ProfileRow, "id" | "preferred_payout_schedule">;
        profilesByWinner.set(p.id, p.preferred_payout_schedule ?? "platform_default");
      }
    }
    const payoutVolumeBySchedule = { dailyCents: 0, weeklyCents: 0, monthlyCents: 0 };
    for (const job of completedJobs) {
      const winnerId = (job as { winner_id?: string | null }).winner_id;
      if (!winnerId) continue;
      const listing = listingsMap.get(job.listing_id as string);
      const gross = listing?.current_lowest_bid_cents ?? 0;
      if (gross <= 0) continue;
      const fee = Math.round(gross * PLATFORM_FEE_RATE);
      const net = gross - fee;
      const preferred = profilesByWinner.get(winnerId) ?? "platform_default";
      const interval = getEffectivePayoutSchedule(
        preferred as "daily" | "weekly" | "monthly" | "platform_default",
        platformPayout
      );
      if (interval === "daily") payoutVolumeBySchedule.dailyCents += net;
      else if (interval === "weekly") payoutVolumeBySchedule.weeklyCents += net;
      else payoutVolumeBySchedule.monthlyCents += net;
    }

    return {
      profile,
      stats: {
        totalUsers,
        activeListings: activeListingsCount ?? 0,
        activeJobs: activeJobsCount,
        completedJobs: completedJobsCount,
        openDisputes: openDisputesCount ?? 0,
        totalRevenueCents,
        pendingPayoutsCents,
      },
      revenuePoints,
      revenueSummary,
      recentActivity: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        userName: userNames.get(n.user_id) ?? "User",
        createdAt: n.created_at,
        message: n.message_text,
        jobId: n.job_id,
      })),
      payoutVolumeBySchedule,
      error: null as string | null,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load admin dashboard data.";
    return {
      profile,
      stats: null,
      revenuePoints: [] as AdminRevenuePoint[],
      revenueSummary: null as AdminRevenueSummary | null,
      recentActivity: [] as any[],
      payoutVolumeBySchedule: { dailyCents: 0, weeklyCents: 0, monthlyCents: 0 },
      error: message,
    };
  }
}

export default async function AdminDashboardPage() {
  const { profile, stats, recentActivity, error, revenuePoints, revenueSummary, payoutVolumeBySchedule } =
    await getAdminDashboardData();

  return (
    <AdminShell activeHref="/admin/dashboard">
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold tracking-tight md:text-2xl dark:text-gray-100">
            Admin Dashboard
          </CardTitle>
          <p className="text-xs text-muted-foreground sm:text-sm dark:text-gray-400">
            {profile.full_name ?? "Admin"} · Monitor Bond Back health, users, jobs and
            disputes.
          </p>
        </CardHeader>
      </Card>

      <Card className="border-dashed border-amber-500/30 bg-amber-50/40 dark:border-amber-800/50 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Notifications QA</CardTitle>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Temporary: send a test in-app notification to your account (check bell and unread
            count).
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <AdminSendTestNotificationButton />
        </CardContent>
      </Card>

      {error && (
        <Alert
          className="border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
          variant="destructive"
        >
          <AlertTriangle className="h-4 w-4" />
          {/* AlertTitle removed in newer shadcn/ui – using h5 instead */}
          <h5 className="mb-1 font-medium leading-none tracking-tight text-sm font-semibold">
            Error loading data
          </h5>
          <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Users
            </p>
            <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              <UserIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {stats ? (
              <p className="text-2xl font-semibold tabular-nums dark:text-gray-100">
                {stats.totalUsers.toLocaleString()}
              </p>
            ) : (
              <Skeleton className="h-7 w-16 rounded-md" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Active Listings
            </p>
            <div className="rounded-full bg-sky-100 p-1.5 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
              <ListIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {stats ? (
              <p className="text-2xl font-semibold tabular-nums dark:text-gray-100">
                {stats.activeListings}
              </p>
            ) : (
              <Skeleton className="h-7 w-16 rounded-md" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Active Jobs
            </p>
            <div className="rounded-full bg-amber-100 p-1.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
              <Briefcase className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {stats ? (
              <p className="text-2xl font-semibold tabular-nums dark:text-gray-100">
                {stats.activeJobs}
              </p>
            ) : (
              <Skeleton className="h-7 w-16 rounded-md" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Completed Jobs
            </p>
            <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {stats ? (
              <p className="text-2xl font-semibold tabular-nums dark:text-gray-100">
                {stats.completedJobs}
              </p>
            ) : (
              <Skeleton className="h-7 w-16 rounded-md" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Platform Revenue
            </p>
            <div className="rounded-full bg-slate-100 p-1.5 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {stats ? (
              <p className="text-2xl font-semibold tabular-nums dark:text-gray-100">
                ${(stats.totalRevenueCents / 100).toFixed(0)}
              </p>
            ) : (
              <Skeleton className="h-7 w-20 rounded-md" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Open Disputes
            </p>
            <div className="rounded-full bg-red-100 p-1.5 text-red-700 dark:bg-red-900/40 dark:text-red-200">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {stats ? (
              <p className="text-2xl font-semibold tabular-nums dark:text-gray-100">
                {stats.openDisputes}
              </p>
            ) : (
              <Skeleton className="h-7 w-16 rounded-md" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold dark:text-gray-100">
            Quick actions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/users"
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            View All Users
          </Link>
          <Link
            href="/admin/disputes"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-muted dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            View Open Disputes
          </Link>
          <Link
            href="/admin/activity"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-muted dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            Activity log
          </Link>
          <AdminExportDataButton />
          <div className="ml-auto">
            <AdminBackupButton />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AdminRevenueChart
            points={revenuePoints ?? []}
            summary={revenueSummary ?? null}
          />
        </div>
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold dark:text-gray-100">
              Payout volume by schedule
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Net payout volume (completed jobs) by cleaner payout schedule.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Daily</span>
              <span className="font-medium tabular-nums dark:text-gray-100">
                ${(payoutVolumeBySchedule.dailyCents / 100).toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Weekly</span>
              <span className="font-medium tabular-nums dark:text-gray-100">
                ${(payoutVolumeBySchedule.weeklyCents / 100).toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly</span>
              <span className="font-medium tabular-nums dark:text-gray-100">
                ${(payoutVolumeBySchedule.monthlyCents / 100).toFixed(0)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold dark:text-gray-100">
              Pending Payouts
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Jobs completed but payouts not yet processed (Stripe integration coming soon).
            </p>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="space-y-1">
                <p className="text-2xl font-semibold tabular-nums dark:text-gray-100">
                  ${(stats.pendingPayoutsCents / 100).toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Currently using a stubbed integration – values will update once Stripe escrow
                  is live.
                </p>
              </div>
            ) : (
              <Skeleton className="h-9 w-32 rounded-md" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold dark:text-gray-100">
              Recent Activity
            </CardTitle>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Last 10 events
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground dark:bg-gray-900/40">
              No recent activity yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Event</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-[140px] text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity.map((item) => {
                    const created = new Date(item.createdAt);
                    const timeAgo = formatDistanceToNow(created, { addSuffix: true });

                    let label = "Activity";
                    let tone: "default" | "success" | "warning" | "info" = "default";

                    if (item.type === "job_created") {
                      label = "New job created";
                      tone = "info";
                    } else if (item.type === "job_accepted") {
                      label = "Job accepted";
                      tone = "success";
                    } else if (item.type === "job_completed") {
                      label = "Job completed";
                      tone = "success";
                    } else if (item.type === "payment_released") {
                      label = "Payment released";
                      tone = "success";
                    } else if (item.type === "dispute_opened") {
                      label = "Dispute opened";
                      tone = "warning";
                    } else if (item.type === "dispute_resolved") {
                      label = "Dispute resolved";
                      tone = "info";
                    } else if (item.type === "new_bid") {
                      label = "New bid";
                      tone = "info";
                    } else if (item.type === "new_message") {
                      label = "New message";
                      tone = "default";
                    }

                    let badgeClass =
                      "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200";
                    if (tone === "success") {
                      badgeClass =
                        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
                    } else if (tone === "warning") {
                      badgeClass =
                        "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
                    } else if (tone === "info") {
                      badgeClass =
                        "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
                    }

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass}`}>
                            {label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium dark:text-gray-100">
                          {item.userName}
                        </TableCell>
                        <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                          {item.message}
                          {item.jobId && (
                            <span className="ml-1 text-[11px] font-medium text-sky-700 hover:underline dark:text-sky-300">
                              <a href={`/jobs/${item.jobId}`}>View job →</a>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {timeAgo}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
