import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Badge } from "@/components/ui/badge";
import {
  QuickStatsRow,
  QuickActionsRow,
  DashboardListingCard,
  CollapsibleActivityFeed,
  DashboardEmptyState,
} from "@/components/dashboard";
import { ListerActiveJobsList } from "@/components/mobile-fab";
import { ResponsiveListerListingCards } from "@/components/lister/responsive-lister-listing-cards";
import { cn } from "@/lib/utils";
import { formatCents, isListingLive, listingIdsWithCancelledJobs } from "@/lib/listings";
import { parseUtcTimestamp } from "@/lib/utils";
import { ChevronDown, XCircle } from "lucide-react";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getProfileCompletion } from "@/lib/profile-completion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

/** Always fresh data after admin moderation / job cancel (avoid stale listing cards). */
export const dynamic = "force-dynamic";

export default async function ListerDashboardPage() {
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
  if (!roles.includes("lister")) redirect("/dashboard");

  const [listingsRes, jobsRes, notificationsRes, globalSettings] = await Promise.all([
    supabase
      .from("listings")
      .select("*")
      .eq("lister_id", session.user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, listing_id, status, created_at, updated_at")
      .eq("lister_id", session.user.id),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    getGlobalSettings(),
  ]);
  const feePercentage =
    globalSettings?.platform_fee_percentage ??
    globalSettings?.fee_percentage ??
    12;

  const listings = (listingsRes.data ?? []) as ListingRow[];
  const jobs = (jobsRes.data ?? []) as JobRow[];
  const notifications = (notificationsRes.data ?? []) as NotificationRow[];

  const listingIds = listings.map((l) => l.id);
  let bidCountByListingId: Record<string, number> = {};
  if (listingIds.length > 0) {
    const { data: bidsData } = await supabase
      .from("bids")
      .select("listing_id")
      .in("listing_id", listingIds as string[]);
    const bids = bidsData ?? [];
    bidCountByListingId = bids.reduce<Record<string, number>>((acc, b) => {
      const id = String((b as { listing_id: string }).listing_id);
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
  }

  const listingIdsWithActiveJob = new Set(
    jobs
      .filter((j) =>
        ["accepted", "in_progress", "completed", "completed_pending_approval"].includes(j.status)
      )
      .map((j) => String(j.listing_id))
  );

  const cancelledJobListingIds = listingIdsWithCancelledJobs(jobs);

  const liveListings = listings.filter(
    (l) =>
      l.status === "live" &&
      isListingLive(l as ListingRow) &&
      !listingIdsWithActiveJob.has(String(l.id)) &&
      !cancelledJobListingIds.has(String(l.id))
  );

  const completedJobs = jobs.filter((j) => j.status === "completed");
  const activeJobs = jobs.filter(
    (j) =>
      j.status === "accepted" ||
      j.status === "in_progress" ||
      j.status === "completed_pending_approval"
  );
  const cancelledJobs = jobs.filter((j) => j.status === "cancelled");
  const cancelledJobListingIdSet = new Set(
    cancelledJobs.map((j) => String(j.listing_id))
  );
  /** Listings ended early by lister (bidding stage) — no job row; see cancelled_early_at column. */
  const cancelledEarlyListings = listings.filter((l) => {
    const row = l as ListingRow & { cancelled_early_at?: string | null };
    if (!row.cancelled_early_at) return false;
    if (cancelledJobListingIdSet.has(String(l.id))) return false;
    return true;
  });
  const totalCancelledItems = cancelledJobs.length + cancelledEarlyListings.length;
  const listingMap = new Map(listings.map((l) => [l.id, l]));

  type CancelledDashboardRow =
    | { kind: "job"; id: string; cancelledAt: string; job: JobRow }
    | { kind: "listing"; id: string; cancelledAt: string; listing: ListingRow };
  const cancelledRows: CancelledDashboardRow[] = [
    ...cancelledJobs.map((job) => {
      const jobRow = job as { updated_at?: string | null };
      return {
        kind: "job" as const,
        id: `job-${job.id}`,
        cancelledAt: jobRow.updated_at ?? "",
        job,
      };
    }),
    ...cancelledEarlyListings.map((listing) => {
      const row = listing as ListingRow & { cancelled_early_at?: string | null };
      return {
        kind: "listing" as const,
        id: `listing-${listing.id}`,
        cancelledAt: row.cancelled_early_at ?? "",
        listing,
      };
    }),
  ].sort(
    (a, b) =>
      new Date(b.cancelledAt).getTime() - new Date(a.cancelledAt).getTime()
  );

  const completedListingIds = new Set(
    completedJobs.map((j) => String(j.listing_id))
  );
  const totalSpentCents = listings
    .filter((l) => completedListingIds.has(String(l.id)))
    .reduce(
      (sum, l) => sum + ((l.current_lowest_bid_cents as number | null) ?? 0),
      0
    );
  const avgCostPerJobCents =
    completedJobs.length > 0
      ? Math.round(totalSpentCents / completedJobs.length)
      : 0;

  const stats = [
    { label: "Active Listings", value: liveListings.length },
    { label: "Completed Jobs", value: completedJobs.length },
    { label: "Total Spent", value: formatCents(totalSpentCents) },
    {
      label: "Avg per Job",
      value: avgCostPerJobCents > 0 ? formatCents(avgCostPerJobCents) : "—",
    },
  ];

  const actions = [
    {
      label: "Create New Listing",
      href: "/listings/new",
      primary: true,
      icon: "plus" as const,
    },
    { label: "Browse Cleaners", href: "/cleaners", icon: "search" as const },
    { label: "My Active Jobs", href: "/my-listings?tab=active_listings", icon: "briefcase" as const },
    { label: "My Completed Jobs", href: "/my-listings?tab=completed_jobs", icon: "check-circle" as const },
  ];

  const activityItems = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    message_text: n.message_text,
    job_id: n.job_id,
    created_at: n.created_at,
  }));

  const nowMs = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const createdAtMs = profile.created_at ? new Date(profile.created_at).getTime() : 0;
  const welcomeWithinMs = 7 * 24 * 60 * 60 * 1000;
  const showWelcomeBanner =
    createdAtMs > 0 && nowMs - createdAtMs < welcomeWithinMs;

  const completion = getProfileCompletion({
    ...profile,
    active_role: "lister",
  } as ProfileRow);
  const showProfileProgressNudge = completion.percent < 100;

  return (
    <section className="page-inner space-y-10 pb-32 sm:pb-8 md:space-y-6 md:pb-8">
      {/* Mobile: title — sticky; desktop: title only (no job search / radius — listers use Browse Cleaners / listings) */}
      <div className="sticky top-0 z-30 -mx-4 space-y-2 border-b border-border bg-background/95 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:border-gray-800 dark:bg-gray-950/95 md:static md:mx-0 md:space-y-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <header className="flex items-center justify-between gap-3 py-1 sm:static sm:mx-0 sm:px-0 sm:py-0">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground dark:text-gray-100 sm:text-xl">
              Lister Dashboard
            </h1>
            <Badge
              className={cn(
                "shrink-0 text-xs font-medium",
                "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
              )}
            >
              Lister
            </Badge>
          </div>
        </header>
      </div>

      {showWelcomeBanner && (
        <Card className="border-sky-200/80 bg-gradient-to-br from-sky-50 to-background shadow-sm dark:border-sky-800/60 dark:from-sky-950/40 dark:to-gray-950">
          <CardHeader className="space-y-1 pb-2 pt-5 sm:pt-4">
            <CardTitle className="text-xl font-bold tracking-tight sm:text-lg">
              Welcome to Bond Back
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground sm:text-sm">
              You&apos;re set up as a lister — create a listing with clear photos so cleaners can bid with confidence.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {showProfileProgressNudge && (
        <Card className="border-amber-200/90 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/25">
          <CardContent className="space-y-4 pt-5 sm:pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground dark:text-gray-100 sm:text-base">
                  75% complete — add photos to win more jobs
                </p>
                <p className="text-sm text-muted-foreground dark:text-gray-400">
                  Finish your profile and use great photos on listings — listers with complete profiles get more bids.
                </p>
              </div>
              <Button
                asChild
                size="lg"
                className="h-12 w-full shrink-0 px-6 text-base font-semibold sm:h-11 sm:w-auto"
              >
                <Link href="/profile">Complete profile</Link>
              </Button>
            </div>
            <Progress value={75} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Quick stats — horizontal scroll on mobile; larger touch + type on small screens */}
      <QuickStatsRow
        stats={stats}
        scrollOnMobile
        className="[&_.CardContent]:p-5 md:[&_.CardContent]:p-4 [&_p.text-xl]:text-2xl md:[&_p.text-xl]:text-xl [&_p:first-child]:text-xs md:[&_p:first-child]:text-[11px]"
      />

      {/* Quick actions — hidden on mobile when FAB is shown */}
      <div className="hidden sm:block">
        <QuickActionsRow actions={actions} />
      </div>

      {/* My Active Listings — swipeable cards on mobile, grid on md+ */}
      <div className="space-y-5 md:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground dark:text-gray-100 md:text-base md:font-semibold">
            My Active Listings
          </h2>
          {liveListings.length > 0 && (
            <Badge variant="secondary" className="px-2.5 py-1 text-sm md:text-xs">
              {liveListings.length} live
            </Badge>
          )}
        </div>
        {liveListings.length === 0 ? (
          <DashboardEmptyState
            title="No listings yet"
            description="Create a listing to get bids from cleaners."
            actionLabel="Create your first listing"
            actionHref="/listings/new"
            icon="list"
          />
        ) : (
          <ResponsiveListerListingCards
            items={liveListings.map((listing) => {
              const endMs = parseUtcTimestamp(listing.end_time);
              const isUrgent = endMs > nowMs && endMs - nowMs < oneDayMs;
              return {
                listing,
                bidCount: bidCountByListingId[String(listing.id)] ?? 0,
                isUrgent,
                feePercentage,
              };
            })}
          />
        )}
      </div>

      {/* Active jobs */}
      <div className="rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:rounded-xl md:border">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4 dark:border-gray-800 md:px-4 md:py-3">
          <h2 className="text-xl font-bold text-foreground dark:text-gray-100 md:text-sm md:font-semibold">
            Active Jobs
          </h2>
          {activeJobs.length > 0 && (
            <Link
              href="/my-listings?tab=active_listings"
              className="min-h-10 px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline md:min-h-0 md:text-xs md:font-medium"
            >
              View all
            </Link>
          )}
        </div>
        <div className="p-4 md:p-3">
          {activeJobs.length === 0 ? (
            <p className="py-8 text-center text-base text-muted-foreground dark:text-gray-400 md:py-6 md:text-sm">
              No active jobs.
            </p>
          ) : (
            <ListerActiveJobsList
              items={activeJobs.slice(0, 5).map((job) => {
                const listing = listingMap.get(job.listing_id);
                return {
                  jobId: Number(job.id),
                  title: listing?.title ?? `Job #${job.id}`,
                  suburb: listing?.suburb ?? null,
                  postcode: listing?.postcode != null ? String(listing.postcode) : null,
                };
              })}
            />
          )}
        </div>
      </div>

      {/* Completed jobs — vertical list (no horizontal swipe) */}
      <div className="rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:rounded-xl md:border">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4 dark:border-gray-800 md:px-4 md:py-3">
          <h2 className="text-xl font-bold text-foreground dark:text-gray-100 md:text-sm md:font-semibold">
            Completed Jobs
          </h2>
          {completedJobs.length > 0 && (
            <Link
              href="/my-listings?tab=completed_jobs"
              className="min-h-10 px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline md:min-h-0 md:text-xs md:font-medium"
            >
              View all
            </Link>
          )}
        </div>
        <div className="p-4 md:p-3">
          {completedJobs.length === 0 ? (
            <p className="py-6 text-center text-base text-muted-foreground dark:text-gray-400 md:py-5 md:text-sm">
              No completed jobs yet. When a job finishes, it will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {completedJobs.slice(0, 5).map((job) => {
                const listing = listingMap.get(job.listing_id);
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
                        <p className="text-sm text-muted-foreground">Completed</p>
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

      {/* Recent activity — below completed jobs */}
      <CollapsibleActivityFeed
        items={activityItems}
        viewAllHref="/notifications"
        emptyMessage="Bids, job updates and payments will appear here."
      />

      {/* Cancelled listings / jobs — jobs with status cancelled + listings ended early (no job row) */}
      <details className="group rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:rounded-xl md:border">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 text-base font-semibold text-foreground dark:text-gray-200 md:min-h-0 md:px-4 md:py-3 md:text-sm md:font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            Cancelled listings / jobs
            {totalCancelledItems > 0 && (
              <Badge variant="destructive" className="text-xs">
                {totalCancelledItems}
              </Badge>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-4 py-3 dark:border-gray-800">
          {totalCancelledItems === 0 ? (
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              No cancelled listings or jobs yet. Items you cancel appear here for history.
            </p>
          ) : (
            <ul className="space-y-2">
              {cancelledRows.map((row) => {
                if (row.kind === "job") {
                  const { job } = row;
                  const listing = listingMap.get(job.listing_id);
                  const jobRow = job as { updated_at?: string | null };
                  const cancelledAt = jobRow.updated_at
                    ? format(new Date(jobRow.updated_at), "d MMM yyyy")
                    : null;
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm transition hover:bg-muted/50 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:bg-gray-800/70"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground dark:text-gray-100">
                            {listing?.title ?? `Job #${job.id}`}
                          </p>
                          <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                            Job cancelled by you
                            {cancelledAt && ` · ${cancelledAt}`} · Un-assigned
                          </p>
                        </div>
                        <span className="text-xs font-medium text-primary">
                          View →
                        </span>
                      </Link>
                    </li>
                  );
                }
                const { listing } = row;
                const cancelledAt = row.cancelledAt
                  ? format(new Date(row.cancelledAt), "d MMM yyyy")
                  : null;
                return (
                  <li key={row.id}>
                    <Link
                      href={`/jobs/${listing.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm transition hover:bg-muted/50 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:bg-gray-800/70"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground dark:text-gray-100">
                          {listing.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                          Listing ended early (auction cancelled)
                          {cancelledAt && ` · ${cancelledAt}`}
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
  );
}
