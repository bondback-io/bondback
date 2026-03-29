import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { EarningsPageClient } from "@/components/features/earnings-page-client";
import { getEffectivePayoutSchedule, getNextPayoutEstimate, formatPayoutScheduleLabel } from "@/lib/payout-schedule";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import type { Database } from "@/types/supabase";

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
  winner_id: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  payment_released_at?: string | null;
  agreed_amount_cents?: number | null;
  cleaner_confirmed_complete?: boolean;
  cleaner_confirmed_at?: string | null;
};

/** Match payout history: agreed amount wins when set. */
function jobGrossCents(job: JobRow, listing: ListingRow | undefined): number {
  const agreed = job.agreed_amount_cents;
  if (typeof agreed === "number" && agreed > 0) return agreed;
  const low = listing?.current_lowest_bid_cents;
  return typeof low === "number" && low > 0 ? low : 0;
}

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

  const { data: jobsData } = await supabase
    .from("jobs")
    .select("id, listing_id, status, created_at, updated_at, payment_released_at, agreed_amount_cents, cleaner_confirmed_complete, cleaner_confirmed_at")
    .eq("winner_id", sessionData.user.id)
    .in("status", [
      "accepted",
      "in_progress",
      "completed",
      "completed_pending_approval",
    ])
    .order("created_at", { ascending: false });

  const jobs = (jobsData ?? []) as JobRow[];
  const listingIds = [...new Set(jobs.map((j) => j.listing_id))];
  let listingsMap = new Map<string, ListingRow>();

  if (listingIds.length > 0) {
    const { data: listingsData } = await supabase
      .from("listings")
      .select("id, title, current_lowest_bid_cents")
      .in("id", listingIds);
    (listingsData ?? []).forEach((l: any) => {
      listingsMap.set(l.id, l as ListingRow);
    });
  }

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
  const completedWithRelease = jobs.filter(
    (j) => j.status === "completed" && j.payment_released_at
  );
  for (const job of completedWithRelease) {
    const listing = listingsMap.get(job.listing_id);
    const grossCents = jobGrossCents(job, listing);
    if (grossCents <= 0) continue;
    const feeCents = Math.round(grossCents * PLATFORM_FEE_RATE);
    const netCents = grossCents;
    const releasedAt = job.payment_released_at!;
    payoutHistory.push({
      jobId: job.id,
      title: listing?.title ?? `Job #${job.id}`,
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

  const completedJobs = jobs.filter((j) => j.status === "completed");
  const pendingJobs = jobs.filter(
    (j) =>
      j.status === "accepted" ||
      j.status === "in_progress" ||
      j.status === "completed_pending_approval"
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
    const grossCents = jobGrossCents(job, listing);
    if (grossCents <= 0) continue;

    const feeCents = Math.round(grossCents * PLATFORM_FEE_RATE);
    const netCents = grossCents; // Cleaner receives full bid amount; platform fee is paid by the lister
    const title = listing?.title ?? `Job #${job.id}`;

    let status: "Pending" | "Processing" | "Paid" = "Pending";
    if (job.status === "completed") status = "Paid";
    else if (job.cleaner_confirmed_complete) status = "Processing";

    transactions.push({
      jobId: job.id,
      date: job.created_at,
      title,
      grossCents,
      feeCents,
      netCents,
      status,
      payoutDate: job.status === "completed" && (job.payment_released_at ?? job.updated_at) ? (job.payment_released_at ?? job.updated_at ?? null) : null,
    });

    if (job.status === "completed") {
      const d = job.payment_released_at || job.updated_at || job.created_at;
      chartEvents.push({
        date: d,
        grossCents,
        netCents,
      });
    }
  }

  const totalEarningsCents = completedJobs.reduce((sum, j) => {
    const listing = listingsMap.get(j.listing_id);
    return sum + jobGrossCents(j, listing);
  }, 0);

  const thisMonthCents = completedJobs.reduce((sum, j) => {
    const listing = listingsMap.get(j.listing_id);
    const c = jobGrossCents(j, listing);
    const jobDate = new Date(j.updated_at || j.created_at);
    if (jobDate >= monthStart && jobDate <= now) return sum + c;
    return sum;
  }, 0);

  const pendingPayoutsCents = pendingJobs.reduce((sum, j) => {
    const listing = listingsMap.get(j.listing_id);
    return sum + jobGrossCents(j, listing);
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
    const grossCents = jobGrossCents(j, listing);
    if (grossCents <= 0) return;
    const feeCents = Math.round(grossCents * PLATFORM_FEE_RATE);
    const netCents = grossCents; // Cleaner receives full bid amount; platform fee is paid by the lister
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
    const grossCents = jobGrossCents(job, listing);
    if (grossCents <= 0) continue;
    const netCents = grossCents; // Cleaner receives full bid amount; platform fee is paid by the lister
    const title = listing?.title ?? `Job #${job.id}`;

    const updatedAt = job.updated_at ? new Date(job.updated_at).getTime() : 0;
    const confirmedAt = job.cleaner_confirmed_at
      ? new Date(job.cleaner_confirmed_at).getTime()
      : updatedAt;
    const nowMs = now.getTime();

    if (
      job.status !== "completed" &&
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

    if (job.status === "completed") {
      const releasedAt = job.payment_released_at ? new Date(job.payment_released_at).getTime() : null;
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
