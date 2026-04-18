import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { getCachedTakenListingIds } from "@/lib/cached-taken-listing-ids";
import { FIND_JOBS_LISTINGS_CAP } from "@/lib/supabase/queries";
import { applyListingAuctionOutcomes } from "@/lib/actions/listings";
import type { Database } from "@/types/supabase";
import { buildLiveListingsQuery } from "@/lib/jobs-query";
import { buildListerCardDataByListingId } from "@/lib/lister-card-data";
import { bidCountsForListingIds } from "@/lib/marketplace/server-cache";
import { JobsList } from "@/components/features/jobs-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MapPin, SearchX } from "lucide-react";
import { JobsPageMobileShell } from "@/components/features/jobs-page-mobile-shell";
import { OfflineJobsPrimer } from "@/components/offline/offline-jobs-primer";
import { JobsPageMobileChrome } from "@/components/mobile-job-search";
import { clampMaxTravelKm, nextSearchRadiusKm } from "@/lib/max-travel-km";
import { FindJobsBrowseShell } from "@/components/find-jobs/find-jobs-browse-shell";
import type { FindJobsViewerActiveRole } from "@/components/find-jobs/find-jobs-map-context";
import { haversineKm } from "@/lib/geo/haversine-km";
import { resolveListingCoordinatesById } from "@/lib/find-jobs/resolve-listing-coordinates";
import {
  DEFAULT_FIND_JOBS_CENTER,
  DEFAULT_FIND_JOBS_RADIUS_KM,
} from "@/lib/find-jobs/map-constants";
import { listingsToFindJobsMapPoints } from "@/lib/find-jobs/map-points-from-listings";

export const metadata: Metadata = {
  title: "Find bond cleaning jobs",
  description:
    "Search bond cleaning and end of lease jobs near you in Australia. Filter by suburb, compare bids, and find your next bond back clean on Bond Back.",
  alternates: { canonical: "/find-jobs" },
  openGraph: {
    title: "Find bond cleaning jobs · Bond Back",
    description:
      "Find live bond cleaning and vacate cleaning listings — reverse-auction pricing across Australia.",
    url: "/find-jobs",
  },
};

export const revalidate = 30;

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

type FindJobsPageSearchParams = {
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

async function FindJobsPageContent({
  searchParams,
}: {
  searchParams?: Promise<FindJobsPageSearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createServerSupabaseClient();

  await applyListingAuctionOutcomes();

  /** Parallel: session + taken listing ids (independent I/O). */
  const [session, takenIds] = await Promise.all([
    getSessionWithProfile(),
    getCachedTakenListingIds(),
  ]);
  const sessionUserId = session?.user.id ?? null;

  const viewerActiveRole: FindJobsViewerActiveRole =
    session?.activeRole === "lister" || session?.activeRole === "cleaner"
      ? session.activeRole
      : null;
  const viewerIsCleaner = Boolean(
    session && session.roles.includes("cleaner") && session.activeRole === "cleaner"
  );

  let profileSuburb: string | null = null;
  let defaultRadiusKm = clampMaxTravelKm(30);
  if (sessionUserId) {
    const { data: travelRow } = await supabase
      .from("profiles")
      .select("max_travel_km, suburb")
      .eq("id", sessionUserId)
      .maybeSingle();
    const row = travelRow as { max_travel_km?: number | null; suburb?: string | null } | null;
    if (row) {
      profileSuburb = row.suburb ?? null;
      defaultRadiusKm = clampMaxTravelKm(
        typeof row.max_travel_km === "number" && row.max_travel_km > 0 ? row.max_travel_km : 30
      );
    }
  }

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

  const bedroomsNormalized =
    bedroomsFilter && bedroomsFilter.toLowerCase() !== "any" ? bedroomsFilter : undefined;
  const bathroomsNormalized =
    bathroomsFilter && bathroomsFilter.toLowerCase() !== "any" ? bathroomsFilter : undefined;
  const propertyTypeNormalized =
    propertyTypeFilter && propertyTypeFilter.toLowerCase() !== "any"
      ? propertyTypeFilter
      : undefined;

  const filters = {
    suburb: suburbFilter || undefined,
    postcode: postcodeFilter || undefined,
    sort: sort || undefined,
    min_price: minPriceFilter || undefined,
    max_price: maxPriceFilter || undefined,
    min_bid_price: minBidPriceFilter || undefined,
    max_bid_price: maxBidPriceFilter || undefined,
    buy_now_only: buyNowOnlyFilter || undefined,
    bedrooms: bedroomsNormalized,
    bathrooms: bathroomsNormalized,
    property_type: propertyTypeNormalized,
  };

  const query = buildLiveListingsQuery(supabase, filters, takenIds);
  const { data: listings } = await query.range(0, FIND_JOBS_LISTINGS_CAP - 1);

  const liveListings = (listings ?? []) as ListingRow[];

  const radiusParsed = radiusFilter ? Number(radiusFilter) : NaN;
  const activeRadiusKm =
    Number.isFinite(radiusParsed) && radiusParsed > 0
      ? clampMaxTravelKm(radiusParsed)
      : DEFAULT_FIND_JOBS_RADIUS_KM;

  const urlCenterLat = sp.center_lat ? Number(sp.center_lat) : null;
  const urlCenterLon = sp.center_lon ? Number(sp.center_lon) : null;
  const effectiveCenterLat =
    urlCenterLat != null && Number.isFinite(urlCenterLat)
      ? urlCenterLat
      : DEFAULT_FIND_JOBS_CENTER.lat;
  const effectiveCenterLon =
    urlCenterLon != null && Number.isFinite(urlCenterLon)
      ? urlCenterLon
      : DEFAULT_FIND_JOBS_CENTER.lon;

  const coordsById = await resolveListingCoordinatesById(
    supabase as never,
    liveListings.map((l) => ({
      id: String(l.id),
      suburb: String(l.suburb ?? ""),
      postcode: l.postcode,
    }))
  );

  let initialListings = liveListings.filter((l) => {
    const c = coordsById[l.id];
    if (!c) return true;
    return haversineKm(effectiveCenterLat, effectiveCenterLon, c.lat, c.lon) <= activeRadiusKm;
  });

  const listingsWithCoords: ListingRow[] = initialListings.map((l) => {
    const c = coordsById[l.id];
    if (!c) return l;
    return { ...l, lat: c.lat, lon: c.lon } as ListingRow;
  });

  const listingIds = listingsWithCoords.map((l) => l.id);
  const listerRowsForCards = listingsWithCoords.map((l) => ({
    id: String(l.id),
    lister_id: String(l.lister_id),
  }));

  const [bidCountByListingId, listerCardDataByListingId] = await Promise.all([
    listingIds.length > 0 ? bidCountsForListingIds(listingIds) : Promise.resolve({} as Record<string, number>),
    buildListerCardDataByListingId(supabase, listerRowsForCards),
  ]);

  const mapPoints = listingsToFindJobsMapPoints(listingsWithCoords, bidCountByListingId);

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

  const clearHref = "/find-jobs";

  const currentRadiusForIncrease = Number(radiusFilter || activeRadiusKm);
  const nextRadiusForIncrease = nextSearchRadiusKm(currentRadiusForIncrease);
  const radiusParams = new URLSearchParams(baseParams);
  radiusParams.set("radius_km", String(nextRadiusForIncrease));
  const increaseRadiusHref = `/find-jobs?${radiusParams.toString()}`;

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
    ...(bedroomsNormalized && { bedrooms: bedroomsNormalized }),
    ...(bathroomsNormalized && { bathrooms: bathroomsNormalized }),
    ...(propertyTypeNormalized && { property_type: propertyTypeNormalized }),
  }).toString();

  /** Bumps when URL filters or map window change so client `JobsList` resets from fresh SSR props. */
  const browseSyncKey = [
    jobsListQuery,
    String(activeRadiusKm),
    String(effectiveCenterLat),
    String(effectiveCenterLon),
  ].join("|");

  const listSection =
    listingsWithCoords.length === 0 ? (
      <Card className="mt-2 overflow-hidden border-dashed border-border/90 bg-gradient-to-b from-muted/40 to-card text-center shadow-md dark:border-gray-700 dark:from-gray-950/80 dark:to-gray-900">
        <CardHeader className="space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border dark:bg-gray-950 dark:ring-gray-800">
            <MapPin className="h-8 w-8 text-emerald-600/90 dark:text-emerald-400/90" aria-hidden />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-xl font-semibold tracking-tight dark:text-gray-100">
              No jobs in this search area
            </CardTitle>
            <CardDescription className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
              Nothing matches your filters and map radius yet. Widen the search or post a job — the
              map on the right still shows your search radius so you can explore.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pb-8">
          <ul className="mx-auto max-w-sm space-y-2.5 text-left text-sm text-muted-foreground dark:text-gray-400">
            <li className="flex gap-2">
              <SearchX className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/80" aria-hidden />
              <span>Clear filters or increase radius to see more listings.</span>
            </li>
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/80" aria-hidden />
              <span>Move the map or change suburb/postcode if you&apos;re searching elsewhere.</span>
            </li>
          </ul>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={clearHref}>Clear filters</Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={increaseRadiusHref}>Increase radius</Link>
            </Button>
            <Button type="button" size="sm" asChild>
              <Link href="/listings/new">Create listing</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    ) : (
      <JobsList
        initialListings={listingsWithCoords}
        radiusKm={activeRadiusKm}
        isCleaner={viewerIsCleaner}
        currentUserId={sessionUserId}
        centerLat={effectiveCenterLat}
        centerLon={effectiveCenterLon}
        bidCountByListingId={bidCountByListingId}
        listerCardDataByListingId={listerCardDataByListingId}
        showListerActions={false}
        showMobileRadiusStrip={false}
        listLayout="sidebar"
        mapSync
        findJobsPublicBrowse
        browseSyncKey={browseSyncKey}
        filters={{
          suburb: suburbFilter || undefined,
          postcode: postcodeFilter || undefined,
          sort: sort || undefined,
          min_price: minPriceFilter || undefined,
          max_price: maxPriceFilter || undefined,
          min_bid_price: minBidPriceFilter || undefined,
          max_bid_price: maxBidPriceFilter || undefined,
          buy_now_only: buyNowOnlyFilter || undefined,
          bedrooms: bedroomsNormalized,
          bathrooms: bathroomsNormalized,
          property_type: propertyTypeNormalized,
        }}
      />
    );

  return (
    <div className="flex w-full flex-col bg-emerald-50/90 pb-4 dark:bg-transparent md:pb-6">
      <JobsPageMobileShell>
        <OfflineJobsPrimer jobsListQuery={jobsListQuery}>
          <Suspense fallback={null}>
            <JobsPageMobileChrome
              initialResultCount={listingsWithCoords.length}
              defaultRadiusKm={defaultRadiusKm}
              profileSuburb={profileSuburb}
              initialSuburb={suburbFilter}
              initialPostcode={postcodeFilter}
              initialRadiusKm={activeRadiusKm}
              initialCenterLat={urlCenterLat ?? DEFAULT_FIND_JOBS_CENTER.lat}
              initialCenterLon={urlCenterLon ?? DEFAULT_FIND_JOBS_CENTER.lon}
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
              <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-3 pb-2 md:px-4 lg:pb-0">
                <FindJobsBrowseShell
                  mapPoints={mapPoints}
                  centerLat={effectiveCenterLat}
                  centerLon={effectiveCenterLon}
                  radiusKm={activeRadiusKm}
                  viewerIsCleaner={viewerIsCleaner}
                  viewerUserId={sessionUserId}
                  viewerActiveRole={viewerActiveRole}
                >
                  <div className="space-y-3 lg:space-y-4">{listSection}</div>
                </FindJobsBrowseShell>
              </div>
            </JobsPageMobileChrome>
          </Suspense>
        </OfflineJobsPrimer>
      </JobsPageMobileShell>
    </div>
  );
}

export default async function FindJobsPage({
  searchParams,
}: {
  searchParams?: Promise<FindJobsPageSearchParams>;
}) {
  /**
   * Do not wrap in `<Suspense key={searchParams}>` — a key tied to query params remounts the whole
   * segment on every radius/filter change, flashes `loading.tsx`, and tears down the Leaflet map
   * (search circle disappears). Route-level `loading.tsx` still covers initial navigations to /find-jobs.
   */
  return <FindJobsPageContent searchParams={searchParams} />;
}
