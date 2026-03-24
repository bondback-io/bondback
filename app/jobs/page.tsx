import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchTakenListingIds } from "@/lib/jobs-taken-listing-ids";
import { applyListingAuctionOutcomes } from "@/lib/actions/listings";
import type { Database } from "@/types/supabase";
import { buildLiveListingsQuery } from "@/lib/jobs-query";
import { buildListerCardDataByListingId } from "@/lib/lister-card-data";
import { JobsList } from "@/components/features/jobs-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SearchX } from "lucide-react";
import { JobsPageMobileShell } from "@/components/features/jobs-page-mobile-shell";
import { OfflineJobsPrimer } from "@/components/offline/offline-jobs-primer";
import { JobsPageMobileChrome } from "@/components/mobile-job-search";

export const metadata: Metadata = {
  title: "Browse bond cleaning jobs",
  description:
    "Search bond cleaning and end of lease jobs near you in Australia. Filter by suburb, compare bids, and find your next bond back clean on Bond Back.",
  alternates: { canonical: "/jobs" },
  openGraph: {
    title: "Browse bond cleaning jobs · Bond Back",
    description:
      "Find live bond cleaning and vacate cleaning listings — reverse-auction pricing across Australia.",
    url: "/jobs",
  },
};

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

type JobsPageSearchParams = {
  suburb?: string;
  postcode?: string;
  radius_km?: string;
  center_lat?: string;
  center_lon?: string;
  sort?: string;
  min_price?: string;
  max_price?: string;
  min_bid_price?: string;
  max_bid_price?: string;
  buy_now_only?: string;
  bedrooms?: string;
  bathrooms?: string;
  property_type?: string;
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams?: Promise<JobsPageSearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createServerSupabaseClient();

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) {
    redirect("/login");
  }

  await applyListingAuctionOutcomes();

  const { data } = await supabase
    .from("profiles")
    .select("roles, active_role, max_travel_km, suburb")
    .eq("id", session.user.id)
    .maybeSingle();

  type ProfileSlice = {
    roles?: string[] | null;
    active_role?: string | null;
    max_travel_km?: number | null;
    suburb?: string | null;
  };
  const profile = data as ProfileSlice | null;
  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  const activeRole =
    profile?.active_role === "lister" || profile?.active_role === "cleaner"
      ? profile.active_role
      : (roles[0] ?? null);
  const viewerIsCleaner = roles.includes("cleaner") && activeRole === "cleaner";

  if (!profile || !data) {
    redirect("/dashboard");
  }

  const defaultRadiusKm =
    typeof profile.max_travel_km === "number" && profile.max_travel_km > 0
      ? profile.max_travel_km
      : 30;

  const suburbFilter = (sp.suburb ?? "").trim();
  const postcodeFilter = (sp.postcode ?? "").trim();
  const radiusFilter = (sp.radius_km ?? "").trim();
  const sort = (sp.sort ?? "").trim();
  const minPriceFilter = (sp.min_price ?? "").trim();
  const maxPriceFilter = (sp.max_price ?? "").trim();
  const minBidPriceFilter = (sp.min_bid_price ?? "").trim();
  const maxBidPriceFilter = (sp.max_bid_price ?? "").trim();
  const buyNowOnlyFilter = (sp.buy_now_only ?? "").trim();
  const bedroomsFilter = (sp.bedrooms ?? "").trim();
  const bathroomsFilter = (sp.bathrooms ?? "").trim();
  const propertyTypeFilter = (sp.property_type ?? "").trim();

  // Exclude listings that already have an associated job (assigned/approved).
  // Use admin client when set; otherwise RPC listing_ids_with_jobs (see migration).
  const admin = createSupabaseAdminClient();
  const takenIds = await fetchTakenListingIds(supabase, admin);

  const filters = {
    suburb: suburbFilter || undefined,
    postcode: postcodeFilter || undefined,
    sort: sort || undefined,
    min_price: minPriceFilter || undefined,
    max_price: maxPriceFilter || undefined,
    min_bid_price: minBidPriceFilter || undefined,
    max_bid_price: maxBidPriceFilter || undefined,
    buy_now_only: buyNowOnlyFilter || undefined,
    bedrooms: bedroomsFilter || undefined,
    bathrooms: bathroomsFilter || undefined,
    property_type: propertyTypeFilter || undefined,
  };

  const query = buildLiveListingsQuery(supabase, filters, takenIds);
  const { data: listings } = await query.range(0, 19);

  const liveListings = (listings ?? []) as ListingRow[];
  let initialListings = liveListings;

  // Bid counts per listing for card badges
  const listingIds = initialListings.map((l) => l.id);
  let bidCountByListingId: Record<string, number> = {};
  if (listingIds.length > 0) {
    const { data: bidsData } = await supabase
      .from("bids")
      .select("listing_id")
      .in("listing_id", listingIds);
    const counts: Record<string, number> = {};
    (bidsData ?? []).forEach((row: { listing_id: string | number }) => {
      const id = String(row.listing_id);
      counts[id] = (counts[id] ?? 0) + 1;
    });
    bidCountByListingId = counts;
  }

  const activeRadiusKm = Number(radiusFilter || defaultRadiusKm) || defaultRadiusKm;

  // Optional client-side radius filter if listings have lat/lon and center is provided.
  const centerLat = sp.center_lat ? Number(sp.center_lat) : null;
  const centerLon = sp.center_lon ? Number(sp.center_lon) : null;

  if (!Number.isNaN(centerLat ?? NaN) && !Number.isNaN(centerLon ?? NaN) && centerLat !== null && centerLon !== null) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371; // km

    initialListings = initialListings.filter((l) => {
      const row = l as any;
      const lat = typeof row.lat === "number" ? row.lat : null;
      const lon = typeof row.lon === "number" ? row.lon : null;
      if (lat == null || lon == null) {
        // If we don't have coordinates, keep the listing rather than hiding it.
        return true;
      }
      const dLat = toRad(lat - centerLat);
      const dLon = toRad(lon - centerLon);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(centerLat)) *
          Math.cos(toRad(lat)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const d = R * c;
      return d <= activeRadiusKm;
    });
  }

  const listerCardDataByListingId = await buildListerCardDataByListingId(
    supabase,
    initialListings.map((l) => ({
      id: String(l.id),
      lister_id: String(l.lister_id),
    }))
  );

  // Precompute helper URLs for clear / increase radius actions
  const baseParams = new URLSearchParams();
  if (suburbFilter) baseParams.set("suburb", suburbFilter);
  if (postcodeFilter) baseParams.set("postcode", postcodeFilter);
  if (radiusFilter) baseParams.set("radius_km", radiusFilter);
  if (sp.center_lat) baseParams.set("center_lat", sp.center_lat);
  if (sp.center_lon) baseParams.set("center_lon", sp.center_lon);
  if (minPriceFilter) baseParams.set("min_price", minPriceFilter);
  if (maxPriceFilter) baseParams.set("max_price", maxPriceFilter);
  if (minBidPriceFilter) baseParams.set("min_bid_price", minBidPriceFilter);
  if (maxBidPriceFilter) baseParams.set("max_bid_price", maxBidPriceFilter);
  if (buyNowOnlyFilter === "1") baseParams.set("buy_now_only", "1");
  if (bedroomsFilter && bedroomsFilter !== "any") baseParams.set("bedrooms", bedroomsFilter);
  if (bathroomsFilter && bathroomsFilter !== "any") baseParams.set("bathrooms", bathroomsFilter);
  if (propertyTypeFilter && propertyTypeFilter !== "any") {
    baseParams.set("property_type", propertyTypeFilter);
  }

  const clearHref = "/jobs";

  const currentRadiusForIncrease = Number(radiusFilter || defaultRadiusKm);
  const nextRadiusForIncrease =
    currentRadiusForIncrease < 20 ? 20 : currentRadiusForIncrease < 50 ? 50 : 100;
  const radiusParams = new URLSearchParams(baseParams);
  radiusParams.set("radius_km", String(nextRadiusForIncrease));
  const increaseRadiusHref = `/jobs?${radiusParams.toString()}`;

  const jobsListQuery = new URLSearchParams({
    ...(suburbFilter && { suburb: suburbFilter }),
    ...(postcodeFilter && { postcode: postcodeFilter }),
    ...(radiusFilter && { radius_km: radiusFilter }),
    ...(sort && { sort }),
    ...(minPriceFilter && { min_price: minPriceFilter }),
    ...(maxPriceFilter && { max_price: maxPriceFilter }),
    ...(minBidPriceFilter && { min_bid_price: minBidPriceFilter }),
    ...(maxBidPriceFilter && { max_bid_price: maxBidPriceFilter }),
    ...(buyNowOnlyFilter === "1" && { buy_now_only: "1" }),
    ...(bedroomsFilter && bedroomsFilter !== "any" && { bedrooms: bedroomsFilter }),
    ...(bathroomsFilter && bathroomsFilter !== "any" && { bathrooms: bathroomsFilter }),
    ...(propertyTypeFilter && propertyTypeFilter !== "any" && { property_type: propertyTypeFilter }),
  }).toString();

  return (
    <JobsPageMobileShell>
    <OfflineJobsPrimer jobsListQuery={jobsListQuery}>
    <Suspense fallback={null}>
    <JobsPageMobileChrome
      initialResultCount={initialListings.length}
      defaultRadiusKm={defaultRadiusKm}
      profileSuburb={profile.suburb ?? null}
      initialSuburb={suburbFilter}
      initialPostcode={postcodeFilter}
      initialRadiusKm={activeRadiusKm}
      initialCenterLat={centerLat}
      initialCenterLon={centerLon}
      initialMinBidPrice={minBidPriceFilter}
      initialMaxBidPrice={maxBidPriceFilter}
      initialBuyNowOnly={buyNowOnlyFilter === "1"}
      initialSort={sort}
      initialMinPrice={minPriceFilter}
      initialMaxPrice={maxPriceFilter}
      initialBedrooms={bedroomsFilter}
      initialBathrooms={bathroomsFilter}
      initialPropertyType={propertyTypeFilter}
    >
    <section className="page-inner space-y-6">
      {initialListings.length === 0 ? (
        <Card className="mt-2 border-dashed bg-card/80 text-center shadow-md dark:border-gray-700 dark:bg-gray-900">
          <CardHeader className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted dark:bg-gray-800">
              <SearchX className="h-6 w-6 text-muted-foreground dark:text-gray-400" />
            </div>
            <CardTitle className="text-lg dark:text-gray-100">
              No bond cleans found in this area
            </CardTitle>
            <CardDescription className="text-sm dark:text-gray-400">
              Try tweaking your filters or creating a new listing so cleaners can bid on your job.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-1 text-xs text-muted-foreground dark:text-gray-400">
              <li>• Try increasing the radius</li>
              <li>• Broaden your suburb or postcode search</li>
              <li>• Create your own listing and let cleaners bid</li>
            </ul>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
              >
                <Link href={clearHref}>Clear filters</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                asChild
              >
                <Link href={increaseRadiusHref}>Increase radius</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                asChild
              >
                <Link href="/listings/new">Create listing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <JobsList
          initialListings={initialListings}
          radiusKm={activeRadiusKm}
          isCleaner={viewerIsCleaner}
          currentUserId={session.user.id}
          centerLat={centerLat ?? undefined}
          centerLon={centerLon ?? undefined}
          bidCountByListingId={bidCountByListingId}
          listerCardDataByListingId={listerCardDataByListingId}
          showListerActions={false}
          showMobileRadiusStrip={false}
          filters={{
            suburb: suburbFilter || undefined,
            postcode: postcodeFilter || undefined,
            sort: sort || undefined,
            min_price: minPriceFilter || undefined,
            max_price: maxPriceFilter || undefined,
            min_bid_price: minBidPriceFilter || undefined,
            max_bid_price: maxBidPriceFilter || undefined,
            buy_now_only: buyNowOnlyFilter || undefined,
            bedrooms: bedroomsFilter || undefined,
            bathrooms: bathroomsFilter || undefined,
            property_type: propertyTypeFilter || undefined,
          }}
        />
      )}
    </section>
    </JobsPageMobileChrome>
    </Suspense>
    </OfflineJobsPrimer>
    </JobsPageMobileShell>
  );
}
