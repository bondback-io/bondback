import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { EarningsPageClient } from "@/components/features/earnings-page-client";
import { getEffectivePayoutSchedule, getNextPayoutEstimate, formatPayoutScheduleLabel } from "@/lib/payout-schedule";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import type { Database } from "@/types/supabase";
import { adminJobGrossCents } from "@/lib/admin-job-gross";
import { cleanerNetEarnedCents } from "@/lib/jobs/cleaner-net-earnings";
import {
  isCleanerEarningsPaidJob,
  isDashboardCompletedJob,
} from "@/lib/jobs/dispute-hub-helpers";

const PLATFORM_FEE_RATE = 0.12;

export const metadata: Metadata = {
  title: "Earnings",
  description:
    "Track cleaner earnings and payouts from bond cleaning jobs on Bond Back — Australia.",
  alternates: { canonical: "/earnings" },
  robots: { index: false, follow: true },
};

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobRow = {
  id: number;
  listing_id: string;
  title?: string | null;
  winner_id: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  payment_released_at?: string | null;
  agreed_amount_cents?: number | null;
  cleaner_confirmed_complete?: boolean;
  cleaner_confirmed_at?: string | null;
  dispute_status?: string | null;
  dispute_resolution?: string | null;
  refund_amount?: number | null;
  proposed_refund_amount?: number | null;
  counter_proposal_amount?: number | null;
  completed_at?: string | null;
};

export default async function EarningsPage() {
  const sessionData = await getSessionWithProfile();
  if (!sessionData) redirect("/login");
  /** Must match avatar menu: same `roles` as layout (getUser + normalizeProfileRolesFromDb). */
  if (!sessionData.roles.includes("cleaner")) {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const { data: payoutPrefs } = await supabase
    .from("profiles")
    .select("preferred_payout_schedule")
    .eq("id", sessionData.user.id)
    .maybeSingle();

  const globalSettings = await getGlobalSettings();
  const preferred =
    (payoutPrefs as { preferred_payout_schedule?: string | null } | null)?.preferred_payout_schedule ??
    "platform_default";
  const platformDefault = (globalSettings?.payout_schedule as "daily" | "weekly" | "monthly") ?? "weekly";
  const effectiveSchedule = getEffectivePayoutSchedule(preferred as "daily" | "weekly" | "monthly" | "platform_default", platformDefault);
  const nextPayoutEstimate = getNextPayoutEstimate(effectiveSchedule);

  const userName =
    (sessionData.profile?.full_name?.trim() ||
      sessionData.user.email?.split("@")[0] ||
      "User")
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 50) || "User";

  /** Same RLS gap as listings: completed jobs may not be visible on the user client. */
  const jobsClient = (createSupabaseAdminClient() ?? supabase) as SupabaseClient;
  const jobSelectEarnings =
    "id, listing_id, title, status, created_at, updated_at, payment_released_at, agreed_amount_cents, cleaner_confirmed_complete, cleaner_confirmed_at, dispute_status, dispute_resolution, refund_amount, proposed_refund_amount, counter_proposal_amount, completed_at" as const;
  const { data: jobsData } = await jobsClient
    .from("jobs")
    .select(jobSelectEarnings)
    .eq("winner_id", sessionData.user.id)
    .order("created_at", { ascending: false });

  let jobs = (jobsData ?? []) as JobRow[];
  const { data: acceptedBidRows } = await supabase
    .from("bids")
    .select("listing_id")
    .eq("cleaner_id", sessionData.user.id)
    .eq("status", "accepted");
  const acceptedListingIds = [
    ...new Set(
      (acceptedBidRows ?? [])
        .map((r) => String((r as { listing_id: string }).listing_id).trim())
        .filter(Boolean)
    ),
  ];
  if (acceptedListingIds.length > 0) {
    const { data: jobsFromAcceptedListings } = await jobsClient
      .from("jobs")
      .select(jobSelectEarnings)
      .in("listing_id", acceptedListingIds as string[])
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    const byId = new Map<number, JobRow>();
    for (const j of jobs) {
      byId.set(Number(j.id), j);
    }
    for (const j of (jobsFromAcceptedListings ?? []) as JobRow[]) {
      const id = Number(j.id);
      if (!byId.has(id)) byId.set(id, j);
    }
    jobs = Array.from(byId.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  const listingIds = [...new Set(jobs.map((j) => j.listing_id))];
  let listingsMap = new Map<string, ListingRow>();

  if (listingIds.length > 0) {
    /**
     * User-scoped Supabase client often returns no listing rows for won jobs when RLS or listing
     * status no longer matches marketplace helpers — but gross earnings still need
     * `current_lowest_bid_cents` when `agreed_amount_cents` is unset. Load listings for IDs that
     * already appear on this cleaner's jobs only (same idea as cleaner dashboard lister profiles).
     */
    const listingsClient = (createSupabaseAdminClient() ?? supabase) as SupabaseClient;
    const { data: listingsData } = await listingsClient
      .from("listings")
      .select("id, title, current_lowest_bid_cents")
      .in("id", listingIds as string[]);
    (listingsData ?? []).forEach((l: { id: string }) => {
      listingsMap.set(l.id, l as ListingRow);
    });
  }

  const earningsRowTitle = (job: JobRow, listing?: ListingRow) => {
    const fromListing = (listing as { title?: string | null } | undefined)?.title;
    const raw = (typeof fromListing === "string" && fromListing.trim() ? fromListing : null) ?? job.title;
    const s = typeof raw === "string" ? raw.trim() : "";
    return s.length > 0 ? s : `Job #${job.id}`;
  };

  type PayoutHistoryRow = {
    jobId: number;
    title: string;
    grossCents: number;
    feeCents: number;
    netCents: number;
    payoutDate: string;
    status: "Paid" | "Processing" | "Failed";
    payoutMethod: "stripe";
  };
  const payoutHistory: PayoutHistoryRow[] = [];
  const paidHistoryJobs = jobs.filter((j) => isCleanerEarningsPaidJob(j));
  for (const job of paidHistoryJobs) {
    const listing = listingsMap.get(job.listing_id);
    const grossCents = adminJobGrossCents(job, listing?.current_lowest_bid_cents);
    if (grossCents <= 0) continue;
    const feeCents = Math.round(grossCents * PLATFORM_FEE_RATE);
    const netCents = cleanerNetEarnedCents(job, listing?.current_lowest_bid_cents);
    const releasedAt =
      job.payment_released_at?.trim() ||
      job.updated_at ||
      job.created_at;
    payoutHistory.push({
      jobId: job.id,
      title: earningsRowTitle(job, listing),
      grossCents,
      feeCents,
      netCents,
      payoutDate: releasedAt,
      status: "Paid",
      payoutMethod: "stripe",
    });
  }
  payoutHistory.sort(
    (a, b) => new Date(b.payoutDate).getTime() - new Date(a.payoutDate).getTime()
  );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const completedJobs = jobs.filter((j) => isDashboardCompletedJob(j));
  const pendingJobs = jobs.filter(
    (j) =>
      !isDashboardCompletedJob(j) &&
      (j.status === "accepted" ||
        j.status === "in_progress" ||
        j.status === "completed_pending_approval")
  );

  type TxRow = {
    jobId: number;
    date: string;
    title: string;
    grossCents: number;
    feeCents: number;
    netCents: number;
    status: "Pending" | "Processing" | "Paid";
    payoutDate: string | null;
  };
  const transactions: TxRow[] = [];
  const chartEvents: { date: string; grossCents: number; netCents: number }[] = [];

  for (const job of jobs) {
    const listing = listingsMap.get(job.listing_id);
    const grossCents = adminJobGrossCents(job, listing?.current_lowest_bid_cents);
    if (grossCents <= 0) continue;

    const feeCents = Math.round(grossCents * PLATFORM_FEE_RATE);
    const netCents = isDashboardCompletedJob(job)
      ? cleanerNetEarnedCents(job, listing?.current_lowest_bid_cents)
      : grossCents;
    const title = earningsRowTitle(job, listing);

    let status: "Pending" | "Processing" | "Paid" = "Pending";
    if (isDashboardCompletedJob(job)) status = "Paid";
    else if (job.cleaner_confirmed_complete) status = "Processing";

    transactions.push({
      jobId: job.id,
      date: job.created_at,
      title,
      grossCents,
      feeCents,
      netCents,
      status,
      payoutDate:
        isDashboardCompletedJob(job) && (job.payment_released_at ?? job.updated_at)
          ? (job.payment_released_at ?? job.updated_at ?? null)
          : null,
    });

    if (isDashboardCompletedJob(job)) {
      const d = job.payment_released_at || job.updated_at || job.created_at;
      const netForChart = cleanerNetEarnedCents(job, listing?.current_lowest_bid_cents);
      chartEvents.push({
        date: d,
        grossCents,
        netCents: netForChart,
      });
    }
  }

  const totalEarningsCents = completedJobs.reduce((sum, j) => {
    const listing = listingsMap.get(j.listing_id);
    return sum + cleanerNetEarnedCents(j, listing?.current_lowest_bid_cents);
  }, 0);

  const thisMonthCents = completedJobs.reduce((sum, j) => {
    const listing = listingsMap.get(j.listing_id);
    const c = cleanerNetEarnedCents(j, listing?.current_lowest_bid_cents);
    const jobDate = new Date(j.updated_at || j.created_at);
    if (jobDate >= monthStart && jobDate <= now) return sum + c;
    return sum;
  }, 0);

  const pendingPayoutsCents = pendingJobs.reduce((sum, j) => {
    const listing = listingsMap.get(j.listing_id);
    return sum + adminJobGrossCents(j, listing?.current_lowest_bid_cents);
  }, 0);

  const paidCount = completedJobs.length;
  const averagePerJobCents = paidCount > 0 ? Math.round(totalEarningsCents / paidCount) : 0;

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const periodBreakdown = {
    thisMonth: { grossCents: 0, feeCents: 0, netCents: 0 },
    last30Days: { grossCents: 0, feeCents: 0, netCents: 0 },
    ytd: { grossCents: 0, feeCents: 0, netCents: 0 },
    lifetime: { grossCents: 0, feeCents: 0, netCents: 0 },
  };

  completedJobs.forEach((j) => {
    const listing = listingsMap.get(j.listing_id);
    const grossCents = adminJobGrossCents(j, listing?.current_lowest_bid_cents);
    if (grossCents <= 0) return;
    const feeCents = Math.round(grossCents * PLATFORM_FEE_RATE);
    const netCents = cleanerNetEarnedCents(j, listing?.current_lowest_bid_cents);
    const jobDate = new Date(j.updated_at || j.created_at);

    periodBreakdown.lifetime.grossCents += grossCents;
    periodBreakdown.lifetime.feeCents += feeCents;
    periodBreakdown.lifetime.netCents += netCents;
    if (jobDate >= yearStart) {
      periodBreakdown.ytd.grossCents += grossCents;
      periodBreakdown.ytd.feeCents += feeCents;
      periodBreakdown.ytd.netCents += netCents;
    }
    if (jobDate >= thirtyDaysAgo) {
      periodBreakdown.last30Days.grossCents += grossCents;
      periodBreakdown.last30Days.feeCents += feeCents;
      periodBreakdown.last30Days.netCents += netCents;
    }
    if (jobDate >= monthStart) {
      periodBreakdown.thisMonth.grossCents += grossCents;
      periodBreakdown.thisMonth.feeCents += feeCents;
      periodBreakdown.thisMonth.netCents += netCents;
    }
  });

  const REVIEW_WINDOW_MS = 48 * 60 * 60 * 1000;
  const PROCESSING_DAYS = 4;
  const RECENT_PAID_LIMIT = 15;

  type PayoutItem = {
    jobId: number;
    title: string;
    netCents: number;
    status: "pending_review" | "processing" | "paid" | "in_progress";
    expectedReleaseAt: string | null;
    payoutDate: string | null;
    progressHoursRemaining: number | null;
    listSortKey?: number;
  };

  const upcomingPayoutsRaw: PayoutItem[] = [];
  const paidItems: PayoutItem[] = [];

  for (const job of jobs) {
    const listing = listingsMap.get(job.listing_id);
    const grossCents = adminJobGrossCents(job, listing?.current_lowest_bid_cents);
    if (grossCents <= 0) continue;
    const netCents = isDashboardCompletedJob(job)
      ? cleanerNetEarnedCents(job, listing?.current_lowest_bid_cents)
      : grossCents;
    const title = earningsRowTitle(job, listing);

    const updatedAt = job.updated_at ? new Date(job.updated_at).getTime() : 0;
    const confirmedAt = job.cleaner_confirmed_at
      ? new Date(job.cleaner_confirmed_at).getTime()
      : updatedAt;
    const nowMs = now.getTime();

    if (isDashboardCompletedJob(job)) {
      const releasedAt = job.payment_released_at
        ? new Date(job.payment_released_at).getTime()
        : null;
      const completedMs = releasedAt ?? (updatedAt || confirmedAt || nowMs);
      const daysSinceCompleted = (nowMs - completedMs) / (24 * 60 * 60 * 1000);

      if (releasedAt) {
        paidItems.push({
          jobId: job.id,
          title,
          netCents,
          status: "paid",
          expectedReleaseAt: null,
          payoutDate: new Date(releasedAt).toISOString(),
          progressHoursRemaining: null,
        });
      } else if (isCleanerEarningsPaidJob(job)) {
        paidItems.push({
          jobId: job.id,
          title,
          netCents,
          status: "paid",
          expectedReleaseAt: null,
          payoutDate: new Date(completedMs).toISOString(),
          progressHoursRemaining: null,
        });
      } else if (daysSinceCompleted <= PROCESSING_DAYS) {
        const expectedReleaseMs =
          (updatedAt || confirmedAt || nowMs) + REVIEW_WINDOW_MS + 3 * 24 * 60 * 60 * 1000;
        upcomingPayoutsRaw.push({
          jobId: job.id,
          title,
          netCents,
          status: "processing",
          expectedReleaseAt: new Date(expectedReleaseMs).toISOString(),
          payoutDate: null,
          progressHoursRemaining: null,
        });
      } else {
        paidItems.push({
          jobId: job.id,
          title,
          netCents,
          status: "paid",
          expectedReleaseAt: null,
          payoutDate: new Date(completedMs).toISOString(),
          progressHoursRemaining: null,
        });
      }
      continue;
    }

    if (
      (job.status === "accepted" ||
        job.status === "in_progress" ||
        job.status === "completed_pending_approval") &&
      !job.cleaner_confirmed_complete
    ) {
      upcomingPayoutsRaw.push({
        jobId: job.id,
        title,
        netCents,
        status: "in_progress",
        expectedReleaseAt: null,
        payoutDate: null,
        progressHoursRemaining: null,
        listSortKey: updatedAt || nowMs,
      });
      continue;
    }

    if (
      (job.status === "in_progress" ||
        job.status === "completed_pending_approval") &&
      job.cleaner_confirmed_complete
    ) {
      const expectedReleaseMs = confirmedAt + REVIEW_WINDOW_MS;
      const hoursRemaining = Math.max(
        0,
        (expectedReleaseMs - nowMs) / (60 * 60 * 1000)
      );
      upcomingPayoutsRaw.push({
        jobId: job.id,
        title,
        netCents,
        status: "pending_review",
        expectedReleaseAt: new Date(expectedReleaseMs).toISOString(),
        payoutDate: null,
        progressHoursRemaining: hoursRemaining,
      });
      continue;
    }
  }

  paidItems.sort(
    (a, b) =>
      new Date(b.payoutDate!).getTime() - new Date(a.payoutDate!).getTime()
  );
  const recentPaid = paidItems.slice(0, RECENT_PAID_LIMIT);
  const upcomingPayouts = [...upcomingPayoutsRaw, ...recentPaid];

  upcomingPayouts.sort((a, b) => {
    const dateA =
      a.listSortKey ??
      (a.expectedReleaseAt
        ? new Date(a.expectedReleaseAt).getTime()
        : a.payoutDate
          ? new Date(a.payoutDate).getTime()
          : 0);
    const dateB =
      b.listSortKey ??
      (b.expectedReleaseAt
        ? new Date(b.expectedReleaseAt).getTime()
        : b.payoutDate
          ? new Date(b.payoutDate).getTime()
          : 0);
    return dateB - dateA;
  });

  const props = {
    totalEarningsCents,
    thisMonthCents,
    pendingPayoutsCents,
    averagePerJobCents,
    transactions,
    chartEvents,
    periodBreakdown,
    upcomingPayouts,
    payoutHistory,
    userName,
    payoutScheduleLabel: formatPayoutScheduleLabel(effectiveSchedule),
    nextPayoutEstimateIso: nextPayoutEstimate.toISOString(),
  };

  return (
    <section className="page-inner space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground dark:text-gray-400">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground hover:underline dark:hover:text-gray-200">
              Home
            </Link>
          </li>
          <li aria-hidden className="select-none text-muted-foreground/50">
            /
          </li>
          <li>
            <Link
              href="/cleaner/dashboard"
              className="transition-colors hover:text-foreground hover:underline dark:hover:text-gray-200"
            >
              Cleaner dashboard
            </Link>
          </li>
          <li aria-hidden className="select-none text-muted-foreground/50">
            /
          </li>
          <li className="font-medium text-foreground dark:text-gray-100" aria-current="page">
            Earnings
          </li>
        </ol>
      </nav>
      <EarningsPageClient {...props} />
    </section>
  );
}
