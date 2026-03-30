import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { applyListingAuctionOutcomes } from "@/lib/actions/listings";
import type { Database } from "@/types/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MyListingsList } from "@/components/features/my-listings-list";
import { MyListingsTabNav } from "@/components/features/my-listings-tab-nav";
import { MyListingsNewListingButton } from "@/components/listing/my-listings-new-listing-button";
import { cn, parseUtcTimestamp } from "@/lib/utils";
import { ArrowLeft, Briefcase } from "lucide-react";

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
  searchParams?: Promise<{ edit?: string; tab?: string; cancel?: string }>;
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

export default async function MyListingsPage({ searchParams }: MyListingsPageProps) {
  const supabase = await createServerSupabaseClient();
  const resolved = searchParams ? await searchParams : {};
  const editId = resolved?.edit ?? null;
  const cancelListingIdParam = resolved?.cancel?.trim() || null;
  const tabParam = (resolved?.tab ?? "active_listings").toLowerCase();
  const tab =
    tabParam === "completed_jobs"
      ? "completed_jobs"
      : tabParam === "pending_payments"
        ? "pending_payments"
        : tabParam === "cancelled_listings"
          ? "cancelled_listings"
          : tabParam === "disputes"
            ? "disputes"
            : "active_listings";

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("roles, active_role, verification_badges")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = data as {
    roles: string[] | null;
    active_role: string | null;
    verification_badges?: string[] | null;
  } | null;
  const roles = (profile?.roles ?? []) as string[];
  const activeRole =
    profile?.active_role === "lister" || profile?.active_role === "cleaner"
      ? profile.active_role
      : null;

  /**
   * Listers must reach this route even if `roles` is briefly out of sync.
   * Allow: lister in roles OR active_role lister. Cleaner-only → cleaner dashboard.
   */
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

  const { data: listingsData, error: listingsError } = await supabase
    .from("listings")
    .select("*")
    .eq("lister_id", session.user.id)
    .order("id", { ascending: false });

  let list: unknown[] = listingsData ?? [];
  if (listingsError) {
    const { data: fallback } = await supabase
      .from("listings")
      .select("*")
      .eq("lister_id", session.user.id);
    list = fallback ?? [];
  }

  const initialListings = list as ListingRow[];
  const expiredListingsCount = initialListings.filter(
    (l) => String(l.status ?? "").toLowerCase() === "expired"
  ).length;
  const listingIds = initialListings.map((l) => l.id);
  const settings = await getGlobalSettings();
  const feePercentage =
    settings?.platform_fee_percentage ??
    settings?.fee_percentage ??
    12;

  let activeCount = 0;
  let completedCount = 0;
  let pendingPaymentsCount = 0;
  let cancelledListingsCount = 0;
  let completedCancelledExpiredTabCount = expiredListingsCount;
  let disputesCount = 0;
  /** Seed client so cancelled jobs don’t briefly appear as “live” before useEffect loads jobs */
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
        }
      >
    | undefined;
  if (listingIds.length > 0) {
    const { data: jobsData } = await supabase
      .from("jobs")
      .select(
        "id, listing_id, winner_id, status, cleaner_confirmed_complete, cleaner_confirmed_at, updated_at"
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
      };
    }
    initialActiveJobsSnapshot = jobByListing;

    const nowMs = Date.now();
    const cancelledJobListingIds = new Set(
      jobs.filter((j) => j.status === "cancelled").map((j) => String(j.listing_id))
    );
    // Prefer merged snapshot so duplicate job rows don’t confuse counts / live vs active split
    const listingIdsWithActiveJob = new Set(
      Object.entries(jobByListing)
        .filter(([, row]) => row.status !== "cancelled")
        .map(([lid]) => lid)
    );
    const listingIdsWithNonCompletedJob = new Set(
      Object.entries(jobByListing)
        .filter(([, row]) =>
          row.status === "accepted" ||
          row.status === "in_progress" ||
          row.status === "completed_pending_approval"
        )
        .map(([lid]) => lid)
    );

    // Active Listings tab: match client exactly.
    // Client: liveListings = otherListings (listings NOT in activeIdSet) that are live, not ended, not cancelled.
    // So "live" count must exclude listings that have a non-cancelled job (they're in activeListings, not liveListings).
    const liveCount = initialListings.filter(
      (l) =>
        l.status === "live" &&
        parseUtcTimestamp(String(l.end_time ?? "")) > nowMs &&
        !cancelledJobListingIds.has(String(l.id)) &&
        !listingIdsWithActiveJob.has(String(l.id))
    ).length;
    // Active jobs section: listings with job status accepted or in_progress (unique by listing)
    const activeNonCompletedCount = initialListings.filter((l) =>
      listingIdsWithNonCompletedJob.has(String(l.id))
    ).length;
    activeCount = liveCount + activeNonCompletedCount;

    const uniqueCompletedListings = new Set(
      jobs.filter((j) => j.status === "completed").map((j) => String(j.listing_id))
    );
    completedCount = uniqueCompletedListings.size;
    pendingPaymentsCount = new Set(
      jobs
        .filter(
          (j) =>
            (j.status === "in_progress" ||
              j.status === "completed_pending_approval") &&
            j.cleaner_confirmed_complete === true
        )
        .map((j) => String(j.listing_id))
    ).size;
    cancelledListingsCount = new Set(
      jobs.filter((j) => j.status === "cancelled").map((j) => String(j.listing_id))
    ).size;
    completedCancelledExpiredTabCount =
      cancelledListingsCount + expiredListingsCount;
    disputesCount = new Set(
      jobs
        .filter((j) =>
          ["disputed", "in_review", "dispute_negotiating"].includes(
            String(j.status ?? "")
          )
        )
        .map((j) => String(j.listing_id))
    ).size;
  }

  return (
    <section className="page-inner space-y-5 pb-28 pt-4 sm:space-y-6 sm:pb-8 sm:pt-8 md:space-y-6">
      {/* Mobile: sticky chrome + safe-area; desktop: static */}
      <div className="sticky top-0 z-30 -mx-4 space-y-3 border-b border-border bg-background/95 px-4 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-background/85 dark:border-gray-800 dark:bg-gray-950/95 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:pt-0 md:backdrop-blur-none">
        <Link
          href={dashboardHref}
          className="inline-flex min-h-[44px] touch-manipulation items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to dashboard
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-balance text-xl font-bold tracking-tight text-foreground dark:text-gray-50 sm:text-2xl md:text-3xl">
                My listings
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
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-gray-400 sm:text-base">
              Auctions, jobs, payments and history — optimised for phone use.
            </p>
            <p className="hidden text-sm text-muted-foreground sm:block dark:text-gray-400">
              Manage bond clean auctions, active jobs, payments and history in one place.
            </p>
            <Link
              href="/my-listings/jobs"
              className="inline-flex min-h-[40px] touch-manipulation items-center gap-2 rounded-lg text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400 sm:hidden"
            >
              <Briefcase className="h-4 w-4 shrink-0" aria-hidden />
              Open job list view
            </Link>
          </div>
          <MyListingsNewListingButton
            size="lg"
            className="h-12 min-h-[48px] w-full shrink-0 touch-manipulation rounded-2xl text-base font-semibold shadow-md sm:h-11 sm:w-auto sm:rounded-lg"
          >
            New listing
          </MyListingsNewListingButton>
        </div>
      </div>

      <Card className="overflow-hidden border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/50 shadow-md dark:border-gray-800 dark:from-emerald-950/30 dark:via-gray-950 dark:to-sky-950/20 sm:rounded-xl">
        <CardHeader className="space-y-2 px-4 pb-2 pt-4 sm:px-6 sm:pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <CardTitle className="text-lg font-bold tracking-tight text-foreground dark:text-gray-100 sm:text-xl">
              Listings &amp; jobs
            </CardTitle>
            <Link
              href="/my-listings/jobs"
              className="hidden shrink-0 touch-manipulation items-center gap-1.5 text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline sm:inline-flex dark:text-emerald-400"
            >
              <Briefcase className="h-4 w-4" aria-hidden />
              Job list view
            </Link>
          </div>
          <CardDescription className="text-sm leading-relaxed dark:text-gray-400 sm:text-sm">
            <span className="md:hidden">
              Use the menu below to switch views — same filters as on larger screens.
            </span>
            <span className="hidden md:inline">Choose a tab to filter your listings and jobs.</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-0 pt-0 sm:space-y-6 sm:px-6">
          <MyListingsTabNav
            tab={tab}
            activeCount={activeCount}
            completedCount={completedCount}
            pendingPaymentsCount={pendingPaymentsCount}
            completedCancelledExpiredTabCount={completedCancelledExpiredTabCount}
            disputesCount={disputesCount}
          />

          <div className="mx-4 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950/70 sm:mx-0 sm:rounded-xl sm:p-4 md:p-5">
            <MyListingsList
              initialListings={initialListings}
              listerId={session.user.id}
              listerVerificationBadges={
                Array.isArray(profile?.verification_badges)
                  ? profile.verification_badges
                  : null
              }
              initialEditListingId={editId}
              initialOpenCancelListingId={cancelListingIdParam}
              feePercentage={feePercentage}
              initialActiveJobsSnapshot={initialActiveJobsSnapshot}
              viewTab={
                tab === "cancelled_listings"
                  ? "cancelled_listings"
                  : tab === "completed_jobs"
                    ? "completed_jobs"
                    : tab === "pending_payments"
                      ? "pending_payments"
                      : tab === "disputes"
                        ? "disputes"
                        : "active_listings"
              }
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
