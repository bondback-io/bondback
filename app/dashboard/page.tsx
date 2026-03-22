import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { DashboardRoleTabs } from "@/components/dashboard/dashboard-role-tabs";
import { ListerDashboardContent } from "@/components/dashboard/lister-dashboard-content";
import { CleanerDashboardContent } from "@/components/dashboard/cleaner-dashboard-content";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { listingIdsWithCancelledJobs } from "@/lib/listings";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Main dashboard: single-role redirects to role-specific dashboard.
 * Dual-role shows Tabs "Lister View" | "Cleaner View" with ?view=lister | ?view=cleaner.
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { data: profileData, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !profileData) redirect("/onboarding/role-choice");

  const profile = profileData as ProfileRow;
  const roles = (profile.roles as string[] | null) ?? [];
  if (roles.length === 0) redirect("/onboarding/role-choice");

  const activeRole: string =
    (profile.active_role as string | null) ?? roles[0] ?? "lister";
  const isLister = roles.includes("lister");
  const isCleaner = roles.includes("cleaner");

  // Single role: redirect to role-specific dashboard
  if (roles.length === 1) {
    if (isCleaner) redirect("/cleaner/dashboard");
    redirect("/lister/dashboard");
  }

  // Dual role: show tabs and content for selected view.
  // Explicit ?view=lister|cleaner wins; otherwise match header toggle (profiles.active_role).
  const viewParam = await searchParams;
  const explicitView = viewParam?.view;
  const view: "lister" | "cleaner" =
    explicitView === "cleaner"
      ? "cleaner"
      : explicitView === "lister"
        ? "lister"
        : activeRole === "cleaner"
          ? "cleaner"
          : "lister";

  const sessionPayload = {
    user: { id: session.user.id, email: session.user.email ?? undefined },
    profile: {
      full_name: profile.full_name,
      roles: roles as string[],
      activeRole,
      profile_photo_url: profile.profile_photo_url ?? null,
    },
    roles: roles as string[],
    activeRole,
    isAdmin: profile.is_admin === true,
  };

  if (view === "cleaner") {
    const data = await fetchCleanerDashboardData(supabase, session.user.id);
    if (!data) redirect("/onboarding/role-choice");
    return (
      <section className="page-inner space-y-6 pb-24 sm:pb-8">
        <div className="flex justify-center sm:justify-start">
          <DashboardRoleTabs currentView="cleaner" />
        </div>
        <CleanerDashboardContent {...data} sessionPayload={sessionPayload} />
      </section>
    );
  }

  const data = await fetchListerDashboardData(supabase, session.user.id);
  if (!data) redirect("/onboarding/role-choice");
  return (
    <section className="page-inner space-y-6 pb-24 sm:pb-8">
      <div className="flex justify-center sm:justify-start">
        <DashboardRoleTabs currentView="lister" />
      </div>
      <ListerDashboardContent {...data} sessionPayload={sessionPayload} />
    </section>
  );
}

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

async function fetchListerDashboardData(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const [listingsRes, jobsRes, notificationsRes] = await Promise.all([
    supabase.from("listings").select("*").eq("lister_id", userId).order("created_at", { ascending: false }),
    supabase.from("jobs").select("id, listing_id, status, created_at, updated_at").eq("lister_id", userId),
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
  ]);

  const globalSettings = await getGlobalSettings();
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
    const { data: bidsData } = await supabase.from("bids").select("listing_id").in("listing_id", listingIds as string[]);
    const bids = bidsData ?? [];
    bidCountByListingId = bids.reduce<Record<string, number>>((acc, b) => {
      const id = String((b as { listing_id: string }).listing_id);
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
  }

  const { formatCents, isListingLive } = await import("@/lib/listings");
  const { parseUtcTimestamp } = await import("@/lib/utils");

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
  const listingMap = new Map(listings.map((l) => [String(l.id), l]));
  const completedListingIds = new Set(completedJobs.map((j) => String(j.listing_id)));
  const totalSpentCents = listings
    .filter((l) => completedListingIds.has(String(l.id)))
    .reduce((sum, l) => sum + ((l.current_lowest_bid_cents as number | null) ?? 0), 0);
  const avgCostPerJobCents = completedJobs.length > 0 ? Math.round(totalSpentCents / completedJobs.length) : 0;

  const stats = [
    { label: "Active Listings", value: liveListings.length },
    { label: "Completed Jobs", value: completedJobs.length },
    { label: "Total Spent", value: formatCents(totalSpentCents) },
    { label: "Avg per Job", value: avgCostPerJobCents > 0 ? formatCents(avgCostPerJobCents) : "—" },
  ];
  const nowMs = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const activityItems = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    message_text: n.message_text,
    job_id: n.job_id,
    created_at: n.created_at,
  }));

  return {
    liveListings,
    activeJobs,
    cancelledJobs,
    listingMap,
    stats,
    activityItems,
    bidCountByListingId,
    nowMs,
    oneDayMs,
    parseUtcTimestamp,
    feePercentage,
  };
}

async function fetchCleanerDashboardData(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data: jobsData } = await supabase
    .from("jobs")
    .select("id, listing_id, status, created_at, updated_at, cleaner_confirmed_complete")
    .eq("winner_id", userId)
    .in("status", ["accepted", "in_progress", "completed", "completed_pending_approval", "cancelled"])
    .order("created_at", { ascending: false });

  const jobs = (jobsData ?? []) as JobRow[];
  const listingIds = [...new Set(jobs.map((j) => j.listing_id))];
  let listingsMap = new Map<string, ListingRow>();
  if (listingIds.length > 0) {
    const { data: listingsData } = await supabase.from("listings").select("*").in("id", listingIds as string[]);
    (listingsData ?? []).forEach((l: unknown) => {
      const row = l as ListingRow & { id: string | number };
      listingsMap.set(String(row.id), row as ListingRow);
    });
  }

  const activeJobs = jobs.filter(
    (j) =>
      j.status === "accepted" ||
      j.status === "in_progress" ||
      j.status === "completed_pending_approval"
  );
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const cancelledJobs = jobs.filter((j) => j.status === "cancelled");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalEarningsThisMonthCents = completedJobs.reduce((sum, j) => {
    const listing = listingsMap.get(String(j.listing_id));
    const gross = listing?.current_lowest_bid_cents ?? 0;
    const jobDate = new Date(j.updated_at || j.created_at);
    return jobDate >= monthStart && jobDate <= now ? sum + gross : sum;
  }, 0);
  const { formatCents } = await import("@/lib/listings");

  const { data: notificationsData } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  const notifications = (notificationsData ?? []) as NotificationRow[];

  const stats = [
    { label: "Active Jobs", value: activeJobs.length },
    { label: "Completed Jobs", value: completedJobs.length },
    { label: "Earnings This Month", value: formatCents(totalEarningsThisMonthCents) },
    { label: "Average Rating", value: "—" },
  ];
  const activityItems = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    message_text: n.message_text,
    job_id: n.job_id,
    created_at: n.created_at,
  }));

  return {
    activeJobs,
    completedJobs,
    cancelledJobs,
    listingsMap,
    stats,
    activityItems,
    now,
  };
}
