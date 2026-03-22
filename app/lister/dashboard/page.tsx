import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Badge } from "@/components/ui/badge";
import {
  DashboardStickyHeader,
  QuickStatsRow,
  QuickActionsRow,
  DashboardListingCard,
  CollapsibleActivityFeed,
  DashboardEmptyState,
  DashboardPullToRefresh,
} from "@/components/dashboard";
import { formatCents, isListingLive, listingIdsWithCancelledJobs } from "@/lib/listings";
import { parseUtcTimestamp } from "@/lib/utils";
import {
  ChevronDown,
  List as ListIcon,
  XCircle,
} from "lucide-react";
import { getGlobalSettings } from "@/lib/actions/global-settings";

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

  const activeRole = (profile.active_role as string | null) ?? roles[0] ?? "lister";

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
  const listingMap = new Map(listings.map((l) => [l.id, l]));

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

  return (
    <DashboardPullToRefresh>
    <section className="page-inner space-y-6 pb-24 sm:pb-8">
      {/* Sticky header */}
      <DashboardStickyHeader
        title="Lister Dashboard"
        roleLabel="Lister"
        role="lister"
      />

      {/* Quick stats — horizontal scroll on mobile */}
      <QuickStatsRow stats={stats} scrollOnMobile />

      {/* Quick actions — hidden on mobile when FAB is shown */}
      <div className="hidden sm:block">
        <QuickActionsRow actions={actions} />
      </div>

      {/* My Active Listings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground dark:text-gray-100">
            My Active Listings
          </h2>
          {liveListings.length > 0 && (
            <Badge variant="secondary" className="text-xs">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveListings.map((listing) => {
              const endMs = parseUtcTimestamp(listing.end_time);
              const isUrgent = endMs > nowMs && endMs - nowMs < oneDayMs;
              return (
                <DashboardListingCard
                  key={listing.id}
                  listing={listing}
                  bidCount={bidCountByListingId[String(listing.id)] ?? 0}
                  isUrgent={isUrgent}
                  feePercentage={feePercentage}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Two-column: Active jobs list + Recent activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 lg:col-span-1">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-foreground dark:text-gray-100">
              Active Jobs
            </h2>
            {activeJobs.length > 0 && (
              <Link
                href="/my-listings?tab=active_listings"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                View all
              </Link>
            )}
          </div>
          <div className="p-3">
            {activeJobs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground dark:text-gray-400">
                No active jobs.
              </p>
            ) : (
              <ul className="space-y-1">
                {activeJobs.slice(0, 5).map((job) => {
                  const listing = listingMap.get(job.listing_id);
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="block rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 dark:hover:bg-gray-800/50"
                      >
                        <span className="font-medium text-foreground dark:text-gray-100">
                          {listing?.title ?? `Job #${job.id}`}
                        </span>
                        <span className="ml-1 text-muted-foreground dark:text-gray-400">
                          · View
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <CollapsibleActivityFeed
            items={activityItems}
            viewAllHref="/notifications"
            emptyMessage="Bids, job updates and payments will appear here."
          />
        </div>
      </div>

      {/* Cancelled jobs — collapsible */}
      <details className="group rounded-xl border border-border bg-card dark:border-gray-800 dark:bg-gray-900/50">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground dark:text-gray-200 [&::-webkit-details-marker]:hidden">
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
              No cancelled jobs. Cancelled jobs appear here for history.
            </p>
          ) : (
            <ul className="space-y-2">
              {cancelledJobs.map((job) => {
                const listing = listingMap.get(job.listing_id);
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
                          Cancelled by you
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
