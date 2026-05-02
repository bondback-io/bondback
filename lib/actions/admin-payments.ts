"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { resolvePlatformFeePercent } from "@/lib/platform-fee";
import type { Database } from "@/types/supabase";
import { format } from "date-fns";
import { jobCleanerBonusCentsApplied } from "@/lib/jobs/cleaner-net-earnings";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

type JobRow = {
  id: number;
  listing_id: string;
  lister_id: string;
  winner_id: string | null;
  status: string;
  title: string | null;
  agreed_amount_cents: number | null;
  payment_intent_id: string | null;
  cleaner_bonus_cents_applied?: number | null;
  created_at: string;
  updated_at: string;
};

/** Jobs where lister has paid (checkout or saved card); funds + platform fee line item held in escrow. */
const ESCROW_ACTIVE_STATUSES = ["in_progress", "completed_pending_approval"] as const;

function jobAmountCents(
  job: Pick<JobRow, "agreed_amount_cents">,
  listing: ListingRow | undefined
): number {
  const a = job.agreed_amount_cents ?? 0;
  if (a > 0) return a;
  return (listing?.current_lowest_bid_cents ?? 0) as number;
}

function feeCents(amountCents: number, feePercent: number): number {
  if (amountCents <= 0) return 0;
  return Math.round((amountCents * feePercent) / 100);
}

export type MonthlyPoint = {
  month: string;
  feeDollars: number;
  payoutDollars: number;
};

export type RecentTransaction = {
  job: JobRow;
  amountCents: number;
  /** Platform fee implied by job gross × fee % (before Bond Back promo funded from that fee). */
  nominalFeeCents: number;
  /** Extra to cleaner paid by reducing the platform fee slice (not charged to lister). */
  cleanerPromoBonusCents: number;
  /** Fee retained after promo: nominal − promo. */
  feeCents: number;
  payoutCents: number;
};

export type PotentialListingRow = {
  listingId: string;
  title: string;
  suburb: string;
  status: string;
  currentLowestBidCents: number;
  startingPriceCents: number;
  feePercent: number;
  estimatedJobAmountCents: number;
  estimatedPlatformFeeCents: number;
  endTime: string;
};

export type PotentialAcceptedJobRow = {
  jobId: number;
  listingId: string;
  title: string | null;
  agreedAmountCents: number;
  feePercent: number;
  estimatedPlatformFeeCents: number;
  winnerId: string | null;
  winnerName: string | null;
  updatedAt: string;
};

export type ActualEscrowJobRow = {
  jobId: number;
  listingId: string;
  status: string;
  jobAmountCents: number;
  platformFeeCents: number;
  cleanerPayoutCents: number;
  winnerId: string | null;
  winnerName: string | null;
  paymentIntentId: string;
  updatedAt: string;
};

export type PaymentsOverview = {
  /** Realised platform fees from jobs that finished (status completed). */
  totalPlatformRevenueCents: number;
  /** Platform fee portion already charged at checkout while job is still in escrow (active work / review). */
  actualActiveEscrowFeeCents: number;
  /** Sum of estimated fees from live auctions (potential). */
  potentialLiveListingsFeeCents: number;
  /** Sum of estimated fees from accepted jobs not yet paid (potential). */
  potentialAcceptedJobsFeeCents: number;
  potentialTotalFeeCents: number;
  /** Cleaner share still held for jobs in escrow (in progress / pending lister approval to release). */
  pendingPayoutsCents: number;
  paidOutThisMonthCents: number;
  averageFeePerJobCents: number;
  monthlyData: MonthlyPoint[];
  recentTransactions: RecentTransaction[];
  profilesMap: Map<string, { full_name: string | null }>;
  potentialLiveListings: PotentialListingRow[];
  potentialAcceptedJobs: PotentialAcceptedJobRow[];
  actualEscrowJobs: ActualEscrowJobRow[];
};

/**
 * Fetch payments overview for admin: revenue, potential fees, escrow-active fees, monthly aggregates.
 */
export async function getPaymentsOverview(): Promise<PaymentsOverview> {
  const supabase = await createServerSupabaseClient();
  const settings = await getGlobalSettings();

  const { data: jobsData } = await supabase
    .from("jobs")
    .select(
      "id, listing_id, lister_id, winner_id, status, agreed_amount_cents, payment_intent_id, cleaner_bonus_cents_applied, created_at, updated_at, title"
    )
    .order("created_at", { ascending: false });

  const jobs = (jobsData ?? []) as JobRow[];

  const { data: liveListingsData } = await supabase
    .from("listings")
    .select("*")
    .eq("status", "live")
    .order("end_time", { ascending: true });

  const liveListings = (liveListingsData ?? []) as ListingRow[];

  const listingIds = Array.from(
    new Set([
      ...jobs.map((j) => j.listing_id),
      ...liveListings.map((l) => String(l.id)),
    ])
  );

  const listingMap = new Map<string, ListingRow>();
  if (listingIds.length > 0) {
    const { data: listings } = await supabase.from("listings").select("*").in("id", listingIds);
    (listings ?? []).forEach((l: unknown) => {
      const row = l as ListingRow & { id: string };
      listingMap.set(String(row.id), row as ListingRow);
    });
  }

  const winnerIds = Array.from(new Set(jobs.map((j) => j.winner_id).filter(Boolean) as string[]));

  const profilesMap = new Map<string, { full_name: string | null }>();
  if (winnerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", winnerIds);
    (profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
      profilesMap.set(p.id, { full_name: p.full_name });
    });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalPlatformRevenueCents = 0;
  let pendingPayoutsCents = 0;
  let paidOutThisMonthCents = 0;
  let completedCount = 0;
  const byMonth = new Map<string, { feeCents: number; payoutCents: number }>();

  jobs.forEach((job) => {
    const listing = listingMap.get(String(job.listing_id));
    const feePercent = resolvePlatformFeePercent(
      listing?.platform_fee_percentage,
      settings,
      listing?.service_type ?? null
    );
    const amountCents = jobAmountCents(job, listing);
    if (amountCents <= 0) return;

    const nominalFee = feeCents(amountCents, feePercent);
    const promoBonus = jobCleanerBonusCentsApplied(
      job as Parameters<typeof jobCleanerBonusCentsApplied>[0]
    );
    const retainedFee = Math.max(0, nominalFee - promoBonus);
    const payout = amountCents - retainedFee;
    const jobDate = new Date(job.updated_at || job.created_at);
    const monthKey = format(jobDate, "MMM yyyy");

    if (job.status === "completed") {
      totalPlatformRevenueCents += retainedFee;
      completedCount += 1;
      const existing = byMonth.get(monthKey) ?? { feeCents: 0, payoutCents: 0 };
      byMonth.set(monthKey, {
        feeCents: existing.feeCents + retainedFee,
        payoutCents: existing.payoutCents + payout,
      });
      if (jobDate >= monthStart) {
        paidOutThisMonthCents += payout;
      }
    } else if (
      job.payment_intent_id?.trim() &&
      ESCROW_ACTIVE_STATUSES.includes(job.status as (typeof ESCROW_ACTIVE_STATUSES)[number])
    ) {
      pendingPayoutsCents += payout;
    }
  });

  const averageFeePerJobCents =
    completedCount > 0 ? Math.round(totalPlatformRevenueCents / completedCount) : 0;

  const monthlyData: MonthlyPoint[] = Array.from(byMonth.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([month, { feeCents, payoutCents }]) => ({
      month,
      feeDollars: Math.round((feeCents / 100) * 100) / 100,
      payoutDollars: Math.round((payoutCents / 100) * 100) / 100,
    }));

  const recentTransactions: RecentTransaction[] = jobs
    .filter((j) => j.status === "completed")
    .slice(0, 20)
    .map((job) => {
      const listing = listingMap.get(String(job.listing_id));
      const amountCents = jobAmountCents(job, listing);
      const feePercent = resolvePlatformFeePercent(
        listing?.platform_fee_percentage,
        settings,
        listing?.service_type ?? null
      );
      const nominalFee = feeCents(amountCents, feePercent);
      const promoBonus = jobCleanerBonusCentsApplied(
        job as Parameters<typeof jobCleanerBonusCentsApplied>[0]
      );
      const feeRetained = Math.max(0, nominalFee - promoBonus);
      const payout = amountCents - feeRetained;
      return {
        job,
        amountCents,
        nominalFeeCents: nominalFee,
        cleanerPromoBonusCents: promoBonus,
        feeCents: feeRetained,
        payoutCents: payout,
      };
    })
    .filter((r) => r.amountCents > 0);

  let actualActiveEscrowFeeCents = 0;
  const actualEscrowJobs: ActualEscrowJobRow[] = [];

  for (const job of jobs) {
    if (!job.payment_intent_id?.trim()) continue;
    if (!ESCROW_ACTIVE_STATUSES.includes(job.status as (typeof ESCROW_ACTIVE_STATUSES)[number])) continue;

    const listing = listingMap.get(String(job.listing_id));
    const amountCents = jobAmountCents(job, listing);
    const feePercent = resolvePlatformFeePercent(
      listing?.platform_fee_percentage,
      settings,
      listing?.service_type ?? null
    );
    const platformFeeCents = feeCents(amountCents, feePercent);
    if (platformFeeCents <= 0 && amountCents <= 0) continue;

    const cleanerPayoutCents = amountCents - platformFeeCents;
    actualActiveEscrowFeeCents += platformFeeCents;

    const winner = job.winner_id ? profilesMap.get(job.winner_id) : null;
    actualEscrowJobs.push({
      jobId: job.id,
      listingId: String(job.listing_id),
      status: job.status,
      jobAmountCents: amountCents,
      platformFeeCents,
      cleanerPayoutCents,
      winnerId: job.winner_id,
      winnerName: winner?.full_name ?? null,
      paymentIntentId: job.payment_intent_id!,
      updatedAt: job.updated_at || job.created_at,
    });
  }

  actualEscrowJobs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const potentialLiveListings: PotentialListingRow[] = [];
  let potentialLiveListingsFeeCents = 0;

  for (const listing of liveListings) {
    const feePercent = resolvePlatformFeePercent(
      listing.platform_fee_percentage,
      settings,
      listing.service_type ?? null
    );
    const estimatedJobAmountCents =
      (listing.current_lowest_bid_cents ?? 0) > 0
        ? (listing.current_lowest_bid_cents as number)
        : (listing.starting_price_cents ?? listing.reserve_cents ?? 0);
    if (estimatedJobAmountCents <= 0) continue;

    const estFee = feeCents(estimatedJobAmountCents, feePercent);
    potentialLiveListingsFeeCents += estFee;
    potentialLiveListings.push({
      listingId: String(listing.id),
      title: listing.title,
      suburb: listing.suburb,
      status: listing.status,
      currentLowestBidCents: listing.current_lowest_bid_cents as number,
      startingPriceCents: listing.starting_price_cents as number,
      feePercent,
      estimatedJobAmountCents,
      estimatedPlatformFeeCents: estFee,
      endTime: listing.end_time,
    });
  }

  const potentialAcceptedJobs: PotentialAcceptedJobRow[] = [];
  let potentialAcceptedJobsFeeCents = 0;

  for (const job of jobs) {
    if (job.status !== "accepted") continue;
    if (job.payment_intent_id?.trim()) continue;

    const listing = listingMap.get(String(job.listing_id));
    const amountCents = jobAmountCents(job, listing);
    const feePercent = resolvePlatformFeePercent(
      listing?.platform_fee_percentage,
      settings,
      listing?.service_type ?? null
    );
    if (amountCents <= 0) continue;

    const estFee = feeCents(amountCents, feePercent);
    potentialAcceptedJobsFeeCents += estFee;

    const winner = job.winner_id ? profilesMap.get(job.winner_id) : null;
    potentialAcceptedJobs.push({
      jobId: job.id,
      listingId: String(job.listing_id),
      title: job.title ?? listing?.title ?? null,
      agreedAmountCents: amountCents,
      feePercent,
      estimatedPlatformFeeCents: estFee,
      winnerId: job.winner_id,
      winnerName: winner?.full_name ?? null,
      updatedAt: job.updated_at || job.created_at,
    });
  }

  potentialAcceptedJobs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const potentialTotalFeeCents = potentialLiveListingsFeeCents + potentialAcceptedJobsFeeCents;

  return {
    totalPlatformRevenueCents,
    actualActiveEscrowFeeCents,
    potentialLiveListingsFeeCents,
    potentialAcceptedJobsFeeCents,
    potentialTotalFeeCents,
    pendingPayoutsCents,
    paidOutThisMonthCents,
    averageFeePerJobCents,
    monthlyData,
    recentTransactions,
    profilesMap,
    potentialLiveListings,
    potentialAcceptedJobs,
    actualEscrowJobs,
  };
}
