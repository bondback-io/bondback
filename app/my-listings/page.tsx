import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import type { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MyListingsList } from "@/components/features/my-listings-list";
import { cn, parseUtcTimestamp } from "@/lib/utils";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

type MyListingsPageProps = {
  searchParams?: Promise<{ edit?: string; tab?: string }>;
};

/** Fresh list after admin deletes listing or job status changes */
export const dynamic = "force-dynamic";

export default async function MyListingsPage({ searchParams }: MyListingsPageProps) {
  const supabase = await createServerSupabaseClient();
  const resolved = searchParams ? await searchParams : {};
  const editId = resolved?.edit ?? null;
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
  const activeRole = profile?.active_role ?? (roles[0] ?? null);

  if (!roles.includes("lister") || activeRole !== "lister") {
    redirect("/dashboard");
  }

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
  let initialActiveListingIds: (string | number)[] | undefined;

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

    const jobByListing: NonNullable<typeof initialActiveJobsSnapshot> = {};
    for (const j of jobs) {
      const lid = String(j.listing_id);
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
    initialActiveListingIds = jobs
      .filter((j) => j.status !== "cancelled")
      .map((j) => j.listing_id);

    const nowMs = Date.now();
    const cancelledJobListingIds = new Set(
      jobs.filter((j) => j.status === "cancelled").map((j) => j.listing_id)
    );
    // Listings that have any non-cancelled job (shown under "active" on client, so excluded from "live" pool)
    const listingIdsWithActiveJob = new Set(
      jobs.filter((j) => j.status !== "cancelled").map((j) => j.listing_id)
    );
    // Listings that have a job in accepted or in_progress (shown in "Active jobs" section)
    const listingIdsWithNonCompletedJob = new Set(
      jobs
        .filter(
          (j) =>
            j.status === "accepted" ||
            j.status === "in_progress" ||
            j.status === "completed_pending_approval"
        )
        .map((j) => j.listing_id)
    );

    // Active Listings tab: match client exactly.
    // Client: liveListings = otherListings (listings NOT in activeIdSet) that are live, not ended, not cancelled.
    // So "live" count must exclude listings that have a non-cancelled job (they're in activeListings, not liveListings).
    const liveCount = initialListings.filter(
      (l) =>
        l.status === "live" &&
        parseUtcTimestamp(String(l.end_time ?? "")) > nowMs &&
        !cancelledJobListingIds.has(l.id) &&
        !listingIdsWithActiveJob.has(l.id)
    ).length;
    // Active jobs section: listings with job status accepted or in_progress (unique by listing)
    const activeNonCompletedCount = initialListings.filter((l) =>
      listingIdsWithNonCompletedJob.has(l.id)
    ).length;
    activeCount = liveCount + activeNonCompletedCount;

    completedCount = jobs.filter((j) => j.status === "completed").length;
    pendingPaymentsCount = jobs.filter(
      (j) =>
        (j.status === "in_progress" ||
          j.status === "completed_pending_approval") &&
        j.cleaner_confirmed_complete === true
    ).length;
    cancelledListingsCount = jobs.filter((j) => j.status === "cancelled").length;
    disputesCount = jobs.filter((j) =>
      ["disputed", "in_review", "dispute_negotiating"].includes(String(j.status ?? ""))
    ).length;
  }

  return (
    <section className="page-inner space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
            My Listings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your bond clean auctions, active jobs and history.
          </p>
        </div>
        <Button asChild>
          <Link href="/listings/new">New listing</Link>
        </Button>
      </div>

      {/* Pill tabs — match Cleaner > Jobs style (TabsList + TabsTrigger) */}
      <Card className="border-border bg-card shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
        <CardContent className="pt-6">
          <nav
            className="mb-4 flex w-full flex-wrap gap-1 rounded-full bg-muted p-1 text-xs dark:bg-gray-800 dark:text-gray-300 sm:text-sm"
            aria-label="Listings and jobs"
          >
            <Link
              href="/my-listings?tab=active_listings"
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 sm:text-sm",
                tab === "active_listings"
                  ? "bg-background text-foreground shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              Active Listings ({activeCount})
            </Link>
            <Link
              href="/my-listings?tab=completed_jobs"
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 sm:text-sm",
                tab === "completed_jobs"
                  ? "bg-background text-foreground shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              Completed jobs ({completedCount})
            </Link>
            <Link
              href="/my-listings?tab=pending_payments"
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 sm:text-sm",
                tab === "pending_payments"
                  ? "bg-background text-foreground shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              Pending payments ({pendingPaymentsCount})
            </Link>
            <Link
              href="/my-listings?tab=cancelled_listings"
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 sm:text-sm",
                tab === "cancelled_listings"
                  ? "bg-background text-foreground shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              Cancelled listings ({cancelledListingsCount})
            </Link>
            <Link
              href="/my-listings?tab=disputes"
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 sm:text-sm",
                tab === "disputes"
                  ? "bg-background text-foreground shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              Disputes ({disputesCount})
            </Link>
          </nav>
          <MyListingsList
            initialListings={initialListings}
            listerId={session.user.id}
            listerVerificationBadges={
              Array.isArray(profile?.verification_badges)
                ? profile.verification_badges
                : null
            }
            initialEditListingId={editId}
            feePercentage={feePercentage}
            initialActiveJobsSnapshot={initialActiveJobsSnapshot}
            initialActiveListingIds={initialActiveListingIds}
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
        </CardContent>
      </Card>
    </section>
  );
}
