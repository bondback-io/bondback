import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCachedTakenListingIds } from "@/lib/cached-taken-listing-ids";
import {
  LISTING_FULL_SELECT,
  LISTING_LIVE_BID_CARD_SELECT,
  NOTIFICATION_FEED_SELECT,
  PROFILE_CLEANER_DASHBOARD_SELECT,
} from "@/lib/supabase/queries";
import type { Database } from "@/types/supabase";
import { Badge } from "@/components/ui/badge";
import {
  QuickStatsRow,
  QuickActionsRow,
  CollapsibleActivityFeed,
  DashboardEmptyState,
} from "@/components/dashboard";
import { ResponsiveCleanerJobCards } from "@/components/mobile-fab";
import { cn } from "@/lib/utils";
import {
  formatCents,
  getListingCoverUrl,
  getPreferredCleaningDeadlineMs,
  daysUntilPreferredCleaningDeadline,
  isListingLive,
} from "@/lib/listings";
import { parseUtcTimestamp } from "@/lib/utils";
import {
  CleanerLiveBidsSection,
  type CleanerLiveBidItem,
} from "@/components/dashboard/cleaner-live-bids-section";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollToHash } from "@/components/dashboard/scroll-to-hash";
import {
  normalizeProfileRolesFromDb,
  resolveActiveRoleFromProfile,
} from "@/lib/profile-roles";
import { getCleanerReadyToRequestPaymentByJobId } from "@/lib/jobs/cleaner-complete-readiness";
import { detailUrlForCardItem } from "@/lib/navigation/listing-or-job-href";
import { bidCountsForListingIds } from "@/lib/marketplace";
import { getNotificationHref } from "@/lib/notifications/display";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/** Shown on job cards; prefer legal name, then business name. */
function listerDisplayNameFromProfile(row: {
  full_name: string | null;
  business_name: string | null;
}): string | null {
  const full = (row.full_name ?? "").trim();
  if (full.length > 0) return full;
  const biz = (row.business_name ?? "").trim();
  if (biz.length > 0) return biz;
  return null;
}
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

/** Notifications + job rows are per-user; “taken listing” set for live-bid filtering is cached when service role exists. */
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Cleaner dashboard",
  description:
    "Your Bond Back cleaner dashboard — browse bids, active bond cleans, and completed end of lease jobs in Australia.",
  alternates: { canonical: "/cleaner/dashboard" },
  robots: { index: false, follow: true },
};

export default async function CleanerDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_CLEANER_DASHBOARD_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData) redirect("/onboarding/role-choice");

  const profile = profileData as ProfileRow;
  const roles = normalizeProfileRolesFromDb(profile.roles, true);
  if (!roles.includes("cleaner")) redirect("/dashboard");

  const resolvedActive = resolveActiveRoleFromProfile(profile);
  if (resolvedActive === "lister" && roles.includes("lister")) {
    redirect("/lister/dashboard");
  }

  const { data: jobsData } = await supabase
    .from("jobs")
    .select(
      "id, listing_id, status, created_at, updated_at, cleaner_confirmed_complete, agreed_amount_cents, winner_id"
    )
    .eq("winner_id", user.id)
    .in("status", ["accepted", "in_progress", "completed", "completed_pending_approval", "cancelled"])
    .order("created_at", { ascending: false });

  const jobs = (jobsData ?? []) as JobRow[];
  const listingIds = [...new Set(jobs.map((j) => j.listing_id))];

  let listingsMap = new Map<string, ListingRow>();
  if (listingIds.length > 0) {
    const { data: listingsData } = await supabase
      .from("listings")
      .select(LISTING_FULL_SELECT)
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

  const inProgressJobIds = activeJobs
    .filter((j) => j.status === "in_progress")
    .map((j) => Number(j.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const markCompleteReadyByJobId = await getCleanerReadyToRequestPaymentByJobId(
    supabase,
    inProgressJobIds
);

  const listerIdsForActiveJobs = [
    ...new Set(
      activeJobs
        .map((j) => {
          const l = listingsMap.get(String(j.listing_id));
          return l ? (l as { lister_id?: string }).lister_id : undefined;
        })
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  /** Service role bypasses RLS so cleaners can read lister names; user client often returns no rows. */
  const profilesClient = (createSupabaseAdminClient() ?? supabase) as SupabaseClient;
  const listerDisplayNameById = new Map<string, string>();
  if (listerIdsForActiveJobs.length > 0) {
    const { data: listerProfiles } = await profilesClient
      .from("profiles")
      .select("id, full_name, business_name")
      .in("id", listerIdsForActiveJobs);
    for (const row of listerProfiles ?? []) {
      const r = row as {
        id: string;
        full_name: string | null;
        business_name: string | null;
      };
      const name = listerDisplayNameFromProfile(r);
      if (name) listerDisplayNameById.set(r.id, name);
    }
  }

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
    .select(NOTIFICATION_FEED_SELECT)
    .eq("user_id", user.id)
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
    {
      label: "Live bids",
      href: "/cleaner/dashboard#live-bids",
      icon: "gavel" as const,
    },
    { label: "My Active Jobs", href: "/cleaner/dashboard#active-jobs", icon: "briefcase" as const },
    { label: "My Earnings", href: "/earnings", icon: "dollar-sign" as const },
  ];

  const activityItems = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    message_text: n.message_text,
    job_id: n.job_id,
    created_at: n.created_at,
    href: getNotificationHref(n as NotificationRow),
  }));

  const nowMs = Date.now();
  const createdAtMs = profile.created_at ? new Date(profile.created_at).getTime() : 0;
  const welcomeWithinMs = 7 * 24 * 60 * 60 * 1000;
  const showWelcomeBanner =
    createdAtMs > 0 && nowMs - createdAtMs < welcomeWithinMs;

  /** Live listings the cleaner has bid on (auction still open, no job assigned yet). */
  /** Include legacy rows where status was never set (null). Exclude cancelled only. */
  const { data: bidsRaw } = await supabase
    .from("bids")
    .select("listing_id, amount_cents")
    .eq("cleaner_id", user.id)
    .or("status.eq.active,status.is.null");

  const bidRows = (bidsRaw ?? []) as {
    listing_id: string | number;
    amount_cents: number;
  }[];

  const bestBidByListing = new Map<string, number>();
  for (const b of bidRows) {
    const lid = String(b.listing_id);
    const prev = bestBidByListing.get(lid);
    if (prev === undefined || b.amount_cents < prev) {
      bestBidByListing.set(lid, b.amount_cents);
    }
  }

  let liveBidItems: CleanerLiveBidItem[] = [];
  if (bestBidByListing.size > 0) {
    const takenIds = new Set(
      (await getCachedTakenListingIds()).map((id) => String(id))
    );

    const bidListingIds = [...bestBidByListing.keys()];
    const { data: listingsForBids } = await supabase
      .from("listings")
      .select(LISTING_LIVE_BID_CARD_SELECT)
      .in("id", bidListingIds);

    const listingsForBidList = (listingsForBids ?? []) as ListingRow[];

    const liveBidCandidates = listingsForBidList.filter(
      (l) => isListingLive(l) && !takenIds.has(String(l.id))
    );
    const bidCountByListingId =
      liveBidCandidates.length > 0
        ? await bidCountsForListingIds(liveBidCandidates.map((l) => String(l.id)))
        : {};

    liveBidItems = liveBidCandidates
      .map((l) => {
        const myBid = bestBidByListing.get(String(l.id)) ?? 0;
        const currentLow = l.current_lowest_bid_cents ?? 0;
        return {
          listingId: String(l.id),
          title: l.title,
          suburb: l.suburb,
          postcode: l.postcode,
          coverUrl: getListingCoverUrl(l),
          myBidCents: myBid,
          currentLowestCents: currentLow,
          endTimeIso: String(l.end_time ?? ""),
          isLeading: myBid === currentLow,
          bidCount: bidCountByListingId[String(l.id)] ?? 0,
        };
      })
      .sort(
        (a, b) =>
          parseUtcTimestamp(a.endTimeIso) - parseUtcTimestamp(b.endTimeIso)
      )
      .slice(0, 24);
  }

  return (
    <section className="page-inner space-y-10 pb-32 sm:pb-8 md:space-y-6 md:pb-8">
      {/* Mobile: title — sticky; desktop: title only (job search / radius lives on /jobs) */}
      <div className="sticky top-0 z-30 -mx-4 space-y-2 border-b border-border bg-background/95 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:border-gray-800 dark:bg-gray-950/95 md:static md:mx-0 md:space-y-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <header className="flex items-center justify-between gap-3 py-1 sm:static sm:mx-0 sm:px-0 sm:py-0">
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
      </div>

      {showWelcomeBanner && (
        <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-background shadow-sm dark:border-emerald-800/60 dark:from-emerald-950/40 dark:to-gray-950">
          <CardHeader className="space-y-1 pb-2 pt-5 sm:pt-4">
            <CardTitle className="text-xl font-bold tracking-tight sm:text-lg">
              Welcome to Bond Back
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground sm:text-sm">
              You&apos;re set up as a cleaner — add portfolio photos and browse jobs to land your first bond clean.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Quick stats — larger type + padding on mobile; rating stays prominent */}
      <QuickStatsRow
        stats={stats}
        scrollOnMobile
        className="[&_.CardContent]:p-5 md:[&_.CardContent]:p-4 [&_p.text-xl]:text-2xl md:[&_p.text-xl]:text-xl [&_p:first-child]:text-xs md:[&_p:first-child]:text-[11px]"
      />

      {/* Quick actions — sm+ only (mobile: tab bar + main nav for jobs) */}
      <div className="hidden sm:block">
        <QuickActionsRow actions={actions} />
      </div>

      {/* Live reverse-auction listings this cleaner has bid on (still open, not assigned) */}
      <ScrollToHash anchorId="live-bids" />
      <div
        id="live-bids"
        className="scroll-mt-[calc(6rem+env(safe-area-inset-top,0px))] space-y-4 md:scroll-mt-24"
      >
        <div className="rounded-2xl border-2 border-amber-200/70 bg-gradient-to-br from-amber-50/50 via-card to-background shadow-sm dark:border-amber-900/50 dark:from-amber-950/30 dark:via-gray-950 dark:to-gray-950 md:rounded-xl md:border">
          <div className="flex flex-col gap-2 border-b border-amber-200/60 px-5 py-4 dark:border-amber-900/40 sm:flex-row sm:items-center sm:justify-between md:px-4 md:py-3">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-foreground dark:text-gray-100 md:text-base md:font-semibold">
                Live auctions you&apos;ve bid on
              </h2>
              <p className="mt-1 text-sm leading-snug text-muted-foreground dark:text-gray-400 md:text-xs">
                Open listings where your bid is still active — tap to open the job and update your offer.
              </p>
            </div>
            {liveBidItems.length > 0 && (
              <Badge
                variant="secondary"
                className="w-fit shrink-0 px-2.5 py-1 text-sm md:text-xs"
              >
                {liveBidItems.length} live
              </Badge>
            )}
          </div>
          <div className="p-4 md:p-3">
            <CleanerLiveBidsSection items={liveBidItems} />
          </div>
        </div>
      </div>

      {/* My Active Jobs — stacked on mobile, grid on md+ */}
      <ScrollToHash anchorId="active-jobs" />
      <div
        id="active-jobs"
        className="scroll-mt-[calc(6rem+env(safe-area-inset-top,0px))] space-y-5 md:scroll-mt-24 md:space-y-4"
      >
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
              const listerId = listing
                ? (listing as { lister_id?: string }).lister_id
                : undefined;
              const deadlineMs = listing
                ? getPreferredCleaningDeadlineMs(listing)
                : null;
              const daysLeft =
                (job.status === "accepted" || job.status === "in_progress") &&
                deadlineMs != null
                  ? daysUntilPreferredCleaningDeadline(deadlineMs, now)
                  : null;
              return {
                job: {
                  id: job.id,
                  listing_id: String(job.listing_id),
                  status: job.status,
                  winner_id: job.winner_id,
                  cleaner_confirmed_complete: job.cleaner_confirmed_complete,
                  agreed_amount_cents: job.agreed_amount_cents,
                },
                listing,
                daysLeft,
                canMarkCleanComplete:
                  job.status === "in_progress"
                    ? (markCompleteReadyByJobId.get(Number(job.id)) ?? false)
                    : false,
                counterpartyName: listerId ? listerDisplayNameById.get(listerId) ?? null : null,
                counterpartyRole: "lister" as const,
                viewerRole: "cleaner" as const,
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
                const href = detailUrlForCardItem({
                  id: job.id,
                  listing_id: job.listing_id as string,
                  status: job.status,
                  winner_id: job.winner_id,
                });
                return (
                  <li key={job.id}>
                    <Link
                      href={href}
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

      {/* Cancelled jobs — same card chrome as Completed Jobs; collapsed by default */}
      <details className="group rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:rounded-xl md:border">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="border-b border-border px-5 py-4 dark:border-gray-800 md:px-4 md:py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground dark:text-gray-100 md:text-sm md:font-semibold">
                    Cancelled jobs
                  </h2>
                  {cancelledJobs.length > 0 && (
                    <Badge variant="secondary" className="px-2.5 py-0.5 text-sm md:text-xs">
                      {cancelledJobs.length}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm leading-snug text-muted-foreground dark:text-gray-400 md:text-xs">
                  For your records only — jobs a lister cancelled after you were assigned. Tap to expand and
                  view the list.
                </p>
              </div>
              <ChevronDown
                className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 md:h-4 md:w-4"
                aria-hidden
              />
            </div>
          </div>
        </summary>
        <div className="p-4 md:p-3">
          {cancelledJobs.length === 0 ? (
            <p className="py-4 text-center text-base text-muted-foreground dark:text-gray-400 md:py-3 md:text-sm">
              No cancelled jobs. When a lister cancels a job you were assigned to, it will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {cancelledJobs.map((job) => {
                const listing = listingsMap.get(job.listing_id as string);
                const jobRow = job as { updated_at?: string | null };
                const cancelledAt = jobRow.updated_at
                  ? format(new Date(jobRow.updated_at), "d MMM yyyy")
                  : null;
                const detailHref = detailUrlForCardItem({
                  id: job.id,
                  listing_id: job.listing_id as string,
                  status: job.status,
                  winner_id: job.winner_id,
                });
                return (
                  <li key={job.id}>
                    <Link
                      href={detailHref}
                      className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/50 dark:border-gray-800 dark:hover:bg-gray-800/50 md:min-h-12"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-base font-semibold text-foreground dark:text-gray-100 md:line-clamp-1">
                          {listing?.title ?? `Job #${job.id}`}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground dark:text-gray-400">
                          Cancelled by lister
                          {cancelledAt && ` · ${cancelledAt}`} · Un-assigned
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
      </details>

      {/* Recent Activity — collapsible */}
      <CollapsibleActivityFeed
        items={activityItems}
        viewAllHref="/notifications"
        emptyMessage="Job updates and payments will appear here."
      />

    </section>
  );
}
