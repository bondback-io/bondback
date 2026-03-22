"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { format } from "date-fns";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobRow = {
  id: number;
  listing_id: number;
  winner_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

const FEE_RATE = 0.12;

export type MonthlyPoint = {
  month: string;
  feeDollars: number;
  payoutDollars: number;
};

export type RecentTransaction = {
  job: JobRow;
  amountCents: number;
  feeCents: number;
  payoutCents: number;
};

export type PaymentsOverview = {
  totalPlatformRevenueCents: number;
  pendingPayoutsCents: number;
  paidOutThisMonthCents: number;
  averageFeePerJobCents: number;
  monthlyData: MonthlyPoint[];
  recentTransactions: RecentTransaction[];
  profilesMap: Map<string, { full_name: string | null }>;
};

/**
 * Fetch payments overview for admin: revenue totals, monthly aggregates, recent transactions.
 * Uses jobs (completed / in_progress / accepted) + listings for amounts. Fee = 12% of job amount.
 */
export async function getPaymentsOverview(): Promise<PaymentsOverview> {
  const supabase = await createServerSupabaseClient();

  const { data: jobsData } = await supabase
    .from("jobs")
    .select("id, listing_id, winner_id, status, created_at, updated_at")
    .in("status", ["completed", "in_progress", "accepted"])
    .order("created_at", { ascending: false });

  const jobs = (jobsData ?? []) as JobRow[];
  const listingIds = Array.from(new Set(jobs.map((j) => j.listing_id)));
  const listingMap = new Map<number, ListingRow>();

  if (listingIds.length > 0) {
    const { data: listings } = await supabase
      .from("listings")
      .select("*")
      .in("id", listingIds);
    (listings ?? []).forEach((l: unknown) => {
      const row = l as ListingRow & { id: number };
      listingMap.set(row.id, row as ListingRow);
    });
  }

  const winnerIds = Array.from(new Set(jobs.map((j) => j.winner_id).filter(Boolean))) as string[];
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
    const listing = listingMap.get(job.listing_id);
    const amountCents = (listing?.current_lowest_bid_cents ?? 0) as number;
    if (amountCents <= 0) return;

    const feeCents = Math.round(amountCents * FEE_RATE);
    const payoutCents = amountCents - feeCents;
    const jobDate = new Date(job.updated_at || job.created_at);
    const monthKey = format(jobDate, "MMM yyyy");

    if (job.status === "completed") {
      totalPlatformRevenueCents += feeCents;
      completedCount += 1;
      const existing = byMonth.get(monthKey) ?? { feeCents: 0, payoutCents: 0 };
      byMonth.set(monthKey, {
        feeCents: existing.feeCents + feeCents,
        payoutCents: existing.payoutCents + payoutCents,
      });
      if (jobDate >= monthStart) {
        paidOutThisMonthCents += payoutCents;
      }
    } else {
      pendingPayoutsCents += amountCents;
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
      const listing = listingMap.get(job.listing_id);
      const amountCents = (listing?.current_lowest_bid_cents ?? 0) as number;
      const feeCents = Math.round(amountCents * FEE_RATE);
      const payoutCents = amountCents - feeCents;
      return { job, amountCents, feeCents, payoutCents };
    })
    .filter((r) => r.amountCents > 0);

  return {
    totalPlatformRevenueCents,
    pendingPayoutsCents,
    paidOutThisMonthCents,
    averageFeePerJobCents,
    monthlyData,
    recentTransactions,
    profilesMap,
  };
}
