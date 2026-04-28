import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isProfileStripePayoutReady } from "@/lib/stripe-payout-ready";
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
import {
  formatCents,
  isListingLive,
  listingIdsWithCancelledJobs,
  listingTitleWithoutSuburbSuffix,
} from "@/lib/listings";
import { parseUtcTimestamp } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { normalizeServiceType } from "@/lib/service-types";
import { getCachedGlobalSettingsForPages } from "@/lib/cached-global-settings-read";
import { fetchAllListerListingIds, fetchListingsForLister } from "@/lib/actions/listings";
import {
  LISTING_FULL_SELECT,
  NOTIFICATION_FEED_SELECT,
  PROFILE_LISTER_DASHBOARD_SELECT,
} from "@/lib/supabase/queries";
import { resolvePlatformFeePercent } from "@/lib/platform-fee";
import { getListingCoverUrl } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollToHash } from "@/components/dashboard/scroll-to-hash";
import { detailUrlForCardItem, bidCountsForListingIds } from "@/lib/marketplace";
import { getNotificationHref } from "@/lib/notifications/display";
import ListerDashboardLoading from "./loading";
import { normalizeProfileRolesFromDb } from "@/lib/profile-roles";
import { listerNetSettledSpendCents } from "@/lib/jobs/cleaner-net-earnings";
import {
  isDashboardActivePipelineJob,
  isDashboardCompletedJob,
} from "@/lib/jobs/dispute-hub-helpers";
import { resolveListerDashboardJobSelect } from "@/lib/jobs/dashboard-jobs-select";
import { isJobCancelledStatus, isListerJobAwaitingPayment } from "@/lib/jobs/job-status-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildLaunchPromoDashboardModel,
  calendarMonthKeyAuSydney,
  effectiveFreeTierAirbnbRecurringJobsUsed,
  launchPromoFreeJobSlots,
  launchPromoMarketingMonthlyAirbnbRecurringCap,
  launchPromoMarketingPriceCapAud,
  listerLaunchPromoWindowEndDate,
  type GlobalSettingsWithLaunchPromo,
} from "@/lib/launch-promo";
import { LaunchPromoStatusCard } from "@/components/dashboard/launch-promo-status-card";
import { LaunchPromoDashboardBar } from "@/components/promo/launch-promo-dashboard-bar";
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

/** User-specific queries stay per-request; global_settings row is cached + tag-invalidated on admin save. */
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Lister dashboard",
  description:
    "Your Bond Back lister dashboard — manage bond cleaning listings, bids, and jobs across Australia.",
  alternates: { canonical: "/lister/dashboard" },
  robots: { index: false, follow: true },
};

async function ListerDashboardContent() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_LISTER_DASHBOARD_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData) redirect("/onboarding/role-choice");

  const profile = profileData as ProfileRow;
  const roles = normalizeProfileRolesFromDb(profile.roles, true);
  if (!roles.includes("lister")) redirect("/dashboard");

  const [listingsFetched, notificationsRes, globalSettings] = await Promise.all([
    fetchListingsForLister(user.id, {
      select: LISTING_FULL_SELECT,
      orderBy: { column: "created_at", ascending: false },
    }),
    supabase
      .from("notifications")
      .select(NOTIFICATION_FEED_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    getCachedGlobalSettingsForPages(),
  ]);
  const feePercentage =
    globalSettings?.platform_fee_percentage ??
    globalSettings?.fee_percentage ??
    12;
  const feeResolveSource = globalSettings ?? feePercentage;

  let listings = listingsFetched as ListingRow[];
  const notifications = (notificationsRes.data ?? []) as NotificationRow[];

  /**
   * Jobs for this lister must match `/my-listings`: merge by `jobs.lister_id` **and** by
   * `listing_id` for owned listings. `jobs.lister_id` can drift from `listings.lister_id`; querying
   * only `lister_id` hides assigned work from both dashboards.
   */
  const jobsClient = (createSupabaseAdminClient() ?? supabase) as SupabaseClient;
  const listerJobSelect = await resolveListerDashboardJobSelect(jobsClient, user.id);

  const jobById = new Map<number, JobRow>();
  const mergeJobRows = (rows: JobRow[]) => {
    for (const j of rows) {
      jobById.set(Number(j.id), j);
    }
  };

  const mergeJobsByListingIdChunks = async (listingIds: string[]) => {
    const unique = [...new Set(listingIds.map((id) => String(id).trim()).filter(Boolean))];
    const chunkSize = 120;
    for (let i = 0; i < unique.length; i += chunkSize) {
      const slice = unique.slice(i, i + chunkSize);
      const { data } = await jobsClient
        .from("jobs")
        .select(listerJobSelect)
        .in("listing_id", slice as string[]);
      mergeJobRows((data ?? []) as unknown as JobRow[]);
    }
  };

  const { data: jobsByListerRow } = await jobsClient
    .from("jobs")
    .select(listerJobSelect)
    .eq("lister_id", user.id);
  mergeJobRows((jobsByListerRow ?? []) as unknown as JobRow[]);

  const ownedListingIdSet = new Set<string>();
  for (const l of listings) {
    ownedListingIdSet.add(String(l.id));
  }
  for (const id of await fetchAllListerListingIds(user.id)) {
    ownedListingIdSet.add(id);
  }

  await mergeJobsByListingIdChunks([...ownedListingIdSet]);

  const jobListingIds = [...new Set([...jobById.values()].map((j) => String(j.listing_id)))];
  const missingListingIds = jobListingIds.filter((id) => !ownedListingIdSet.has(id));
  if (missingListingIds.length > 0) {
    const { data: extraListings } = await jobsClient
      .from("listings")
      .select(LISTING_FULL_SELECT)
      .in("id", missingListingIds as string[]);
    if (extraListings?.length) {
      listings = [...listings, ...(extraListings as ListingRow[])];
      const addedIds: string[] = [];
      for (const row of extraListings as ListingRow[]) {
        const lid = String(row.id);
        if (!ownedListingIdSet.has(lid)) addedIds.push(lid);
        ownedListingIdSet.add(lid);
      }
      if (addedIds.length > 0) {
        await mergeJobsByListingIdChunks(addedIds);
      }
    }
  }

  const jobs = Array.from(jobById.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const listingIds = listings.map((l) => l.id);
  const bidCountByListingId =
    listingIds.length > 0 ? await bidCountsForListingIds(listingIds) : {};

  /** Any non-cancelled job reserves the listing (includes disputes and completed). */
  const listingIdsWithActiveJob = new Set(
    jobs.filter((j) => !isJobCancelledStatus(j.status)).map((j) => String(j.listing_id))
  );

  const cancelledJobListingIds = listingIdsWithCancelledJobs(jobs);

  const liveListings = listings.filter(
    (l) =>
      l.status === "live" &&
      isListingLive(l as ListingRow) &&
      !listingIdsWithActiveJob.has(String(l.id)) &&
      !cancelledJobListingIds.has(String(l.id))
  );

  const completedJobs = jobs.filter((j) => isDashboardCompletedJob(j));
  const activeJobs = jobs.filter((j) => isDashboardActivePipelineJob(j));
  const awaitingPaymentJobs = activeJobs.filter((j) =>
    isListerJobAwaitingPayment(j as JobRow & { payment_intent_id?: string | null })
  );
  const activeJobsExcludingAwaitingPayment = activeJobs.filter(
    (j) => !isListerJobAwaitingPayment(j as JobRow & { payment_intent_id?: string | null })
  );
  const cancelledJobs = jobs.filter((j) => isJobCancelledStatus(j.status));
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
  const listingMap = new Map(listings.map((l) => [String(l.id), l]));

  const activeJobPreview = activeJobsExcludingAwaitingPayment.slice(0, 5);
  const awaitingPaymentPreview = awaitingPaymentJobs.slice(0, 5);
  const winnerIds = [
    ...new Set(
      [...activeJobPreview, ...awaitingPaymentPreview]
        .map((j) => (j as JobRow & { winner_id?: string | null }).winner_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  let winnerFirstNameById: Record<string, string> = {};
  if (winnerIds.length > 0) {
    /** Service role so lister can read assigned cleaners' names (user-scoped client is often RLS-blocked). */
    const admin = createSupabaseAdminClient();
    const { data: winnerProfiles } = admin
      ? await admin.from("profiles").select("id, full_name").in("id", winnerIds)
      : await supabase.from("profiles").select("id, full_name").in("id", winnerIds);
    for (const row of winnerProfiles ?? []) {
      const r = row as { id: string; full_name: string | null };
      const raw = (r.full_name ?? "").trim();
      const first = raw.split(/\s+/)[0] ?? "";
      winnerFirstNameById[r.id] = first || raw || "Assigned cleaner";
    }
  }

  const requireStripeRelease =
    (globalSettings as { require_stripe_connect_before_payment_release?: boolean } | null)
      ?.require_stripe_connect_before_payment_release !== false;
  const winnerPayoutReadyById = new Map<string, boolean>();
  if (winnerIds.length > 0 && requireStripeRelease) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data: wprows } = await admin
        .from("profiles")
        .select("id, stripe_connect_id, stripe_onboarding_complete")
        .in("id", winnerIds);
      for (const row of wprows ?? []) {
        const r = row as {
          id: string;
          stripe_connect_id?: string | null;
          stripe_onboarding_complete?: boolean | null;
        };
        winnerPayoutReadyById.set(r.id, isProfileStripePayoutReady(r));
      }
    }
  }

  const toListerActiveJobListItem = (job: JobRow) => {
    const listing = listingMap.get(String(job.listing_id));
    const j = job as JobRow & {
      agreed_amount_cents?: number | null;
      payment_intent_id?: string | null;
      winner_id?: string | null;
      cleaner_confirmed_complete?: boolean | null;
    };
    const agreed =
      j.agreed_amount_cents != null && j.agreed_amount_cents > 0
        ? j.agreed_amount_cents
        : (listing as { current_lowest_bid_cents?: number | null } | undefined)
            ?.current_lowest_bid_cents ?? null;
    const winnerId = j.winner_id?.trim() ?? null;
    const stripePayoutSetupRequired =
      requireStripeRelease &&
      winnerId != null &&
      winnerPayoutReadyById.has(winnerId) &&
      winnerPayoutReadyById.get(winnerId) !== true;
    const locationLabel =
      listing != null ? formatLocationWithState(listing.suburb, listing.postcode) : null;
    return {
      jobId: Number(job.id),
      listingId: String(job.listing_id),
      winnerId: j.winner_id?.trim() ? j.winner_id : null,
      title: listing?.title ?? `Job #${job.id}`,
      status: job.status,
      agreedAmountCents: typeof agreed === "number" && agreed > 0 ? agreed : null,
      hasEscrowPayment: !!j.payment_intent_id?.trim(),
      locationLabel,
      coverUrl: getListingCoverUrl(listing ?? null),
      bedrooms:
        listing != null ? (listing as { bedrooms?: number | null }).bedrooms ?? null : null,
      bathrooms:
        listing != null ? (listing as { bathrooms?: number | null }).bathrooms ?? null : null,
      cleanerFirstName:
        winnerId && winnerFirstNameById[winnerId]
          ? winnerFirstNameById[winnerId]
          : winnerId
            ? "Assigned cleaner"
            : null,
      stripePayoutSetupRequired,
      serviceType: normalizeServiceType(
        (listing as { service_type?: string | null } | null)?.service_type
      ),
    };
  };

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

  const totalSpentCents = completedJobs.reduce((sum, job) => {
    const listing = listingMap.get(String(job.listing_id));
    return sum + listerNetSettledSpendCents(job, listing?.current_lowest_bid_cents);
  }, 0);
  const totalFeesCents = completedJobs.reduce((sum, job) => {
    const listing = listingMap.get(String(job.listing_id));
    const netSpend = listerNetSettledSpendCents(job, listing?.current_lowest_bid_cents);
    if (netSpend <= 0) return sum;
    const pct = resolvePlatformFeePercent(
      listing?.platform_fee_percentage,
      feeResolveSource,
      listing?.service_type ?? null
    );
    return sum + Math.round((netSpend * pct) / 100);
  }, 0);

  const stats = [
    { label: "Active Listings", value: liveListings.length },
    { label: "Completed Jobs", value: completedJobs.length },
    { label: "Total Spent", value: formatCents(totalSpentCents) },
    {
      label: "Total Fees",
      value: formatCents(totalFeesCents),
    },
  ];

  const actions = [
    {
      label: "Create New Listing",
      href: "/listings/new",
      primary: true,
      icon: "plus" as const,
      useCreateListingPicker: true,
    },
    { label: "Browse Cleaners", href: "/cleaners", icon: "search" as const },
    {
      label: "My Active Jobs",
      href: "/lister/dashboard#active-jobs",
      icon: "briefcase" as const,
    },
    {
      label: "My Completed Jobs",
      href: "/lister/dashboard#completed-jobs",
      icon: "check-circle" as const,
    },
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
  const oneDayMs = 24 * 60 * 60 * 1000;

  const createdAtMs = profile.created_at ? new Date(profile.created_at).getTime() : 0;
  const welcomeWithinMs = 7 * 24 * 60 * 60 * 1000;
  const showWelcomeBanner =
    createdAtMs > 0 && nowMs - createdAtMs < welcomeWithinMs;

  const launchPromoListerUsed = Math.max(
    0,
    Math.floor(
      Number(
        (profile as ProfileRow & { launch_promo_lister_jobs_used?: number })
          .launch_promo_lister_jobs_used ?? 0
      )
    )
  );
  const launchPromoModel = buildLaunchPromoDashboardModel({
    used: launchPromoListerUsed,
    settings: globalSettings,
    now: new Date(nowMs),
    normalFeePercent: feePercentage,
    profileCreatedAt: profile.created_at,
  });

  const listerLaunchEndsAt = listerLaunchPromoWindowEndDate(
    globalSettings as GlobalSettingsWithLaunchPromo | null,
    profile.created_at
  );
  const listerLaunchEndsAtIso = listerLaunchEndsAt ? listerLaunchEndsAt.toISOString() : null;

  const sydneyMonthKey = calendarMonthKeyAuSydney(new Date(nowMs));
  const freeTierJobsUsedThisMonth = effectiveFreeTierAirbnbRecurringJobsUsed(
    profile as ProfileRow & {
      free_tier_airbnb_recurring_month_key?: string | null;
      free_tier_airbnb_recurring_jobs_used?: number | null;
    },
    sydneyMonthKey
  );

  return (
    <section className="page-inner space-y-10 pb-32 sm:pb-8 md:space-y-6 md:pb-8">
      {/* Mobile: title — sticky; desktop: title only (no job search / radius — listers use Browse Cleaners / listings) */}
      <div className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-border bg-background/95 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:border-gray-800 dark:bg-gray-950/95 md:static md:mx-0 md:space-y-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
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

      {launchPromoModel.phase === "active" ? (
        <LaunchPromoDashboardBar
          userId={user.id}
          variant="lister"
          used={launchPromoListerUsed}
          freeSlots={launchPromoFreeJobSlots(globalSettings as GlobalSettingsWithLaunchPromo | null)}
          endsAtIso={listerLaunchEndsAtIso}
          settings={globalSettings as GlobalSettingsWithLaunchPromo | null}
          profileCreatedAtIso={profile.created_at}
        />
      ) : null}

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

      <LaunchPromoStatusCard
        model={launchPromoModel}
        variant="lister"
        userId={user.id}
        settings={globalSettings as GlobalSettingsWithLaunchPromo | null}
        profileCreatedAtIso={profile.created_at}
        freeTierJobsUsedThisMonth={freeTierJobsUsedThisMonth}
        freeTierMonthlyCap={launchPromoMarketingMonthlyAirbnbRecurringCap(
          globalSettings as GlobalSettingsWithLaunchPromo | null
        )}
        freeTierPriceCapAud={launchPromoMarketingPriceCapAud(
          globalSettings as GlobalSettingsWithLaunchPromo | null
        )}
      />

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

      {/* My Active Listings — stacked cards on mobile, grid on md+ */}
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
            useCreateListingPicker
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
                feePercentage: resolvePlatformFeePercent(
                  listing.platform_fee_percentage,
                  feeResolveSource,
                  listing.service_type ?? null
                ),
              };
            })}
          />
        )}
      </div>

      {/* Awaiting payment (accepted, no escrow yet) */}
      <ScrollToHash anchorId="awaiting-payment" />
      <div
        id="awaiting-payment"
        className="scroll-mt-[calc(6rem+env(safe-area-inset-top,0px))] rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:scroll-mt-24 md:rounded-xl md:border"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4 dark:border-gray-800 md:px-4 md:py-3">
          <h2 className="text-xl font-bold text-foreground dark:text-gray-100 md:text-sm md:font-semibold">
            Awaiting Payment
          </h2>
          {awaitingPaymentJobs.length > 0 && (
            <Link
              href="/my-listings?tab=active"
              className="min-h-10 px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline md:min-h-0 md:text-xs md:font-medium"
            >
              View all
            </Link>
          )}
        </div>
        <div className="p-4 md:p-3">
          {awaitingPaymentJobs.length === 0 ? (
            <p className="py-8 text-center text-base text-muted-foreground dark:text-gray-400 md:py-6 md:text-sm">
              No jobs awaiting payment.
            </p>
          ) : (
            <ListerActiveJobsList
              items={awaitingPaymentPreview.map(toListerActiveJobListItem)}
            />
          )}
        </div>
      </div>

      {/* Active jobs */}
      <ScrollToHash anchorId="active-jobs" />
      <div
        id="active-jobs"
        className="scroll-mt-[calc(6rem+env(safe-area-inset-top,0px))] rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:scroll-mt-24 md:rounded-xl md:border"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4 dark:border-gray-800 md:px-4 md:py-3">
          <h2 className="text-xl font-bold text-foreground dark:text-gray-100 md:text-sm md:font-semibold">
            Active Jobs
          </h2>
          {activeJobsExcludingAwaitingPayment.length > 0 && (
            <Link
              href="/my-listings?tab=active"
              className="min-h-10 px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline md:min-h-0 md:text-xs md:font-medium"
            >
              View all
            </Link>
          )}
        </div>
        <div className="p-4 md:p-3">
          {activeJobsExcludingAwaitingPayment.length === 0 ? (
            <p className="py-8 text-center text-base text-muted-foreground dark:text-gray-400 md:py-6 md:text-sm">
              No active jobs.
            </p>
          ) : (
            <ListerActiveJobsList
              items={activeJobPreview.map(toListerActiveJobListItem)}
            />
          )}
        </div>
      </div>

      {/* Completed jobs — collapsed by default (like Cancelled); count on header */}
      <ScrollToHash anchorId="completed-jobs" />
      <details
        id="completed-jobs"
        className="group scroll-mt-[calc(6rem+env(safe-area-inset-top,0px))] rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:scroll-mt-24 md:rounded-xl md:border"
      >
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="border-b border-border px-5 py-4 dark:border-gray-800 md:px-4 md:py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground dark:text-gray-100 md:text-sm md:font-semibold">
                    Completed Jobs
                  </h2>
                  {completedJobs.length > 0 && (
                    <Badge variant="secondary" className="px-2.5 py-0.5 text-sm md:text-xs">
                      {completedJobs.length}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm leading-snug text-muted-foreground dark:text-gray-400 md:text-xs">
                  Finished work and net amount settled. Tap to expand and view up to five recent
                  completions.
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
          {completedJobs.length > 0 ? (
            <div className="mb-2 flex justify-end">
              <Link
                href="/my-listings?tab=completed"
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline md:text-xs md:font-medium"
              >
                View all
              </Link>
            </div>
          ) : null}
          {completedJobs.length === 0 ? (
            <p className="py-4 text-center text-base text-muted-foreground dark:text-gray-400 md:py-3 md:text-sm">
              No completed jobs yet. When a job finishes, it will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {completedJobs.slice(0, 5).map((job) => {
                const listing = listingMap.get(String(job.listing_id));
                const href = detailUrlForCardItem({
                  id: job.id,
                  listing_id: job.listing_id,
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
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                          <span>Completed</span>
                          <span className="text-xs font-medium text-foreground dark:text-gray-200">
                            Net settled{" "}
                            {formatCents(
                              listerNetSettledSpendCents(job, listing?.current_lowest_bid_cents)
                            )}
                          </span>
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

      {/* Cancelled listings / jobs — same card chrome as cleaner dashboard; below completed */}
      <details className="group rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:rounded-xl md:border">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="border-b border-border px-5 py-4 dark:border-gray-800 md:px-4 md:py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground dark:text-gray-100 md:text-sm md:font-semibold">
                    Cancelled listings / jobs
                  </h2>
                  {totalCancelledItems > 0 && (
                    <Badge variant="secondary" className="px-2.5 py-0.5 text-sm md:text-xs">
                      {totalCancelledItems}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm leading-snug text-muted-foreground dark:text-gray-400 md:text-xs">
                  For your records — listings you ended early or jobs you cancelled after assignment. Tap to expand
                  and view the list.
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
          {totalCancelledItems === 0 ? (
            <p className="py-4 text-center text-base text-muted-foreground dark:text-gray-400 md:py-3 md:text-sm">
              No cancelled listings or jobs yet. Items you cancel appear here for history.
            </p>
          ) : (
            <ul className="space-y-2">
              {cancelledRows.map((row) => {
                if (row.kind === "job") {
                  const { job } = row;
                  const listing = listingMap.get(String(job.listing_id));
                  const jobRow = job as { updated_at?: string | null };
                  const cancelledAt = jobRow.updated_at
                    ? format(new Date(jobRow.updated_at), "d MMM yyyy")
                    : null;
                  const jobHref = detailUrlForCardItem({
                    id: job.id,
                    listing_id: job.listing_id,
                    status: job.status,
                    winner_id: job.winner_id,
                  });
                  const cancelSubtitle =
                    String(job.status) === "cancelled_by_lister"
                      ? "Job cancelled — cleaner non-responsive (escrow refund)"
                      : "Job cancelled by you";
                  return (
                    <li key={row.id}>
                      <Link
                        href={jobHref}
                        className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/50 dark:border-gray-800 dark:hover:bg-gray-800/50 md:min-h-12"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-base font-semibold text-foreground dark:text-gray-100 md:line-clamp-1">
                            {listingTitleWithoutSuburbSuffix(
                              listing?.title ?? `Job #${job.id}`,
                              listing?.suburb
                            )}
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground dark:text-gray-400">
                            {cancelSubtitle}
                            {cancelledAt && ` · ${cancelledAt}`} · Un-assigned
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-primary">View →</span>
                      </Link>
                    </li>
                  );
                }
                const { listing } = row;
                const cancelledAt = row.cancelledAt
                  ? format(new Date(row.cancelledAt), "d MMM yyyy")
                  : null;
                const listingHref = detailUrlForCardItem({
                  id: listing.id,
                  status: listing.status,
                });
                return (
                  <li key={row.id}>
                    <Link
                      href={listingHref}
                      className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/50 dark:border-gray-800 dark:hover:bg-gray-800/50 md:min-h-12"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-base font-semibold text-foreground dark:text-gray-100 md:line-clamp-1">
                          {listingTitleWithoutSuburbSuffix(listing.title, listing.suburb)}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground dark:text-gray-400">
                          Listing ended early (auction cancelled)
                          {cancelledAt && ` · ${cancelledAt}`}
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

      {/* Recent activity — below cancelled */}
      <CollapsibleActivityFeed
        items={activityItems}
        viewAllHref="/notifications"
        emptyMessage="Bids, job updates and payments will appear here."
      />

    </section>
  );
}

export default function ListerDashboardPage() {
  return (
    <Suspense fallback={<ListerDashboardLoading />}>
      <ListerDashboardContent />
    </Suspense>
  );
}
