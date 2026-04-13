import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { applyListingAuctionOutcomes, fetchListingsForLister } from "@/lib/actions/listings";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import type { Database } from "@/types/supabase";
import { MyListingsList, type ListerViewTab } from "@/components/features/my-listings-list";
import {
  isListerNoBidsRelistListing,
  isListerPaidJobListing,
} from "@/lib/my-listings/lister-listing-helpers";
import { MyListingsNewListingButton } from "@/components/listing/my-listings-new-listing-button";
import { parseUtcTimestamp } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

/** When multiple job rows exist for one listing, prefer non-cancelled then newest. */
function preferJobRow<
  T extends { status: string | null; updated_at?: string | null },
>(a: T, b: T): T {
  const ac = a.status === "cancelled";
  const bc = b.status === "cancelled";
  if (ac && !bc) return b;
  if (!ac && bc) return a;
  const ta = a.updated_at ? Date.parse(String(a.updated_at)) : 0;
  const tb = b.updated_at ? Date.parse(String(b.updated_at)) : 0;
  return tb >= ta ? b : a;
}

type MyListingsPageProps = {
  searchParams?: Promise<{ edit?: string; tab?: string; cancel?: string; published?: string }>;
};

/** Fresh list after admin deletes listing or job status changes */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My listings",
  description:
    "Manage your bond cleaning listings, bids, and jobs on Bond Back — end of lease cleaning in Australia.",
  alternates: { canonical: "/my-listings" },
  robots: { index: false, follow: true },
};

function isDisputeJobStatus(s: string | null | undefined): boolean {
  const x = String(s ?? "").toLowerCase();
  return x === "disputed" || x === "in_review" || x === "dispute_negotiating";
}

function parseTabParam(raw: string | undefined): ListerViewTab {
  const t = (raw ?? "active").toLowerCase();
  if (t === "completed" || t === "completed_jobs") return "completed";
  if (t === "drafts") return "drafts";
  if (t === "all" || t === "cancelled_listings") return "all";
  if (t === "disputed" || t === "disputes") return "disputed";
  if (t === "paid" || t === "paid_jobs" || t === "jobs_paid") return "paid";
  if (t === "active" || t === "active_listings" || t === "pending_payments") {
    return "active";
  }
  if (t === "no_bids" || t === "no-bids" || t === "nobids") {
    return "no_bids";
  }
  return "active";
}

export default async function MyListingsPage({ searchParams }: MyListingsPageProps) {
  const supabase = await createServerSupabaseClient();
  const resolved = searchParams ? await searchParams : {};
  const editId = resolved?.edit ?? null;
  const cancelListingIdParam = resolved?.cancel?.trim() || null;
  const tab = parseTabParam(resolved?.tab);
  const showPublishedBanner = resolved?.published === "1";

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("roles, active_role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as {
    roles: string[] | null;
    active_role: string | null;
  } | null;
  const roles = (profile?.roles ?? []) as string[];
  const activeRole =
    profile?.active_role === "lister" || profile?.active_role === "cleaner"
      ? profile.active_role
      : null;

  const canAccessMyListings =
    roles.includes("lister") || activeRole === "lister";
  if (!canAccessMyListings) {
    if (roles.includes("cleaner")) redirect("/cleaner/dashboard");
    redirect("/dashboard");
  }

  const dashboardHref =
    activeRole === "cleaner"
      ? "/cleaner/dashboard"
      : activeRole === "lister"
        ? "/lister/dashboard"
        : roles.includes("lister")
          ? "/lister/dashboard"
          : "/dashboard";

  await applyListingAuctionOutcomes();

  const globalSettings = await getGlobalSettings();
  const allowTwoMinuteAuctionTest =
    (globalSettings as { allow_two_minute_auction_test?: boolean } | null)?.allow_two_minute_auction_test === true;

  const initialListings = await fetchListingsForLister(user.id);
  const listingIds = initialListings.map((l) => l.id);

  let initialActiveJobsSnapshot:
    | Record<
        string,
        {
          jobId: string | number;
          winnerId: string | null;
          winnerName: string;
          status: string | null;
          cleanerConfirmedComplete?: boolean | null;
          cleanerConfirmedAt?: string | null;
          updatedAt?: string | null;
          disputed_at?: string | null;
          dispute_reason?: string | null;
          dispute_status?: string | null;
          dispute_opened_by?: string | null;
          agreed_amount_cents?: number | null;
        }
      >
    | undefined;

  let activeTabCount = 0;
  let completedCount = 0;
  let disputedCount = 0;
  let paidJobsCount = 0;
  let noBidsCount = 0;

  if (listingIds.length > 0) {
    const { data: jobsData } = await supabase
      .from("jobs")
      .select(
        "id, listing_id, winner_id, status, cleaner_confirmed_complete, cleaner_confirmed_at, updated_at, disputed_at, dispute_reason, dispute_status, dispute_opened_by, agreed_amount_cents"
      )
      .in("listing_id", listingIds);
    const jobs = (jobsData ?? []) as {
      id: string | number;
      listing_id: string | number;
      winner_id: string | null;
      status: string | null;
      cleaner_confirmed_complete?: boolean | null;
      cleaner_confirmed_at?: string | null;
      updated_at?: string | null;
      disputed_at?: string | null;
      dispute_reason?: string | null;
      dispute_status?: string | null;
      dispute_opened_by?: string | null;
      agreed_amount_cents?: number | null;
    }[];

    const winnerIds = [
      ...new Set(jobs.map((j) => j.winner_id).filter((id): id is string => Boolean(id))),
    ];
    const nameById: Record<string, string> = {};
    if (winnerIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", winnerIds);
      for (const p of profs ?? []) {
        const row = p as { id: string; full_name: string | null };
        nameById[row.id] = row.full_name?.trim() || "Cleaner";
      }
    }

    const jobsByListing = new Map<string, (typeof jobs)[number][]>();
    for (const j of jobs) {
      const lid = String(j.listing_id);
      const arr = jobsByListing.get(lid) ?? [];
      arr.push(j);
      jobsByListing.set(lid, arr);
    }

    const jobByListing: NonNullable<typeof initialActiveJobsSnapshot> = {};
    for (const [lid, arr] of jobsByListing) {
      const j = arr.reduce((best, cur) => preferJobRow(best, cur));
      jobByListing[lid] = {
        jobId: j.id,
        winnerId: j.winner_id,
        winnerName: j.winner_id ? nameById[j.winner_id] ?? "Cleaner" : "Cleaner",
        status: j.status,
        cleanerConfirmedComplete: j.cleaner_confirmed_complete ?? null,
        cleanerConfirmedAt: j.cleaner_confirmed_at ?? null,
        updatedAt: j.updated_at ?? null,
        disputed_at: j.disputed_at ?? null,
        dispute_reason: j.dispute_reason ?? null,
        dispute_status: j.dispute_status ?? null,
        dispute_opened_by: j.dispute_opened_by ?? null,
        agreed_amount_cents: j.agreed_amount_cents ?? null,
      };
    }
    initialActiveJobsSnapshot = jobByListing;

    const nowMs = Date.now();
    const cancelledJobListingIds = new Set(
      jobs.filter((j) => j.status === "cancelled").map((j) => String(j.listing_id))
    );
    const listingIdsWithActiveJob = new Set(
      Object.entries(jobByListing)
        .filter(([, row]) => row.status !== "cancelled")
        .map(([lid]) => lid)
    );
    const liveCount = initialListings.filter(
      (l) =>
        l.status === "live" &&
        parseUtcTimestamp(String(l.end_time ?? "")) > nowMs &&
        !cancelledJobListingIds.has(String(l.id)) &&
        !listingIdsWithActiveJob.has(String(l.id))
    ).length;
    disputedCount = new Set(
      jobs.filter((j) => isDisputeJobStatus(j.status)).map((j) => String(j.listing_id))
    ).size;

    const activeJobWithoutDisputeCount = initialListings.filter((l) => {
      const row = jobByListing[String(l.id)];
      if (!row || row.status === "cancelled" || row.status === "completed") return false;
      if (isDisputeJobStatus(row.status)) return false;
      return true;
    }).length;

    activeTabCount = liveCount + activeJobWithoutDisputeCount;

    completedCount = new Set(
      jobs.filter((j) => j.status === "completed").map((j) => String(j.listing_id))
    ).size;

    paidJobsCount = initialListings.filter((l) =>
      isListerPaidJobListing(jobByListing[String(l.id)])
    ).length;

    noBidsCount = initialListings.filter((l) =>
      isListerNoBidsRelistListing(l, jobByListing[String(l.id)] ?? null)
    ).length;
  }

  return (
    <section className="page-inner pb-28 pt-4 sm:pb-10 sm:pt-8">
      <div className="sticky top-0 z-30 -mx-4 border-b border-border/80 bg-background/95 px-4 pb-4 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-background/90 dark:border-gray-800 dark:bg-gray-950/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Link
          href={dashboardHref}
          className="mb-4 inline-flex min-h-[44px] touch-manipulation items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to dashboard
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-50 sm:text-3xl">
              My listings
            </h1>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Auctions and jobs in one calm list — optimised for your phone.
            </p>
          </div>
          <MyListingsNewListingButton
            variant="success"
            size="lg"
            className="h-12 min-h-[48px] w-full shrink-0 rounded-2xl text-base font-semibold shadow-sm sm:h-11 sm:w-auto sm:min-w-[220px]"
          >
            Create new listing
          </MyListingsNewListingButton>
        </div>
      </div>

      {showPublishedBanner && (
        <Alert variant="success" className="mt-4 border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50">
          <AlertDescription>
            Your listing is live — cleaners can bid now. Open it below to manage bids or view the
            listing page.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 sm:mt-8">
        <MyListingsList
          initialListings={initialListings}
          listerId={user.id}
          initialEditListingId={editId}
          initialOpenCancelListingId={cancelListingIdParam}
          initialActiveJobsSnapshot={initialActiveJobsSnapshot}
          viewTab={tab}
          allowTwoMinuteAuctionTest={allowTwoMinuteAuctionTest}
          tabCounts={{
            active: activeTabCount,
            paid: paidJobsCount,
            disputed: disputedCount,
            completed: completedCount,
            all: initialListings.length,
            no_bids: noBidsCount,
          }}
        />
      </div>
    </section>
  );
}
