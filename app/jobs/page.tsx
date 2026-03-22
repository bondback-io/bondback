import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { buildLiveListingsQuery } from "@/lib/jobs-query";
import { buildListerCardDataByListingId } from "@/lib/lister-card-data";
import { JobsList } from "@/components/features/jobs-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { FindJobsSearch } from "@/components/features/find-jobs-search";

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
  bedrooms?: string;
  bathrooms?: string;
  property_type?: string;
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams?: JobsPageSearchParams;
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) {
    redirect("/login");
  }

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

  const suburbFilter = (searchParams?.suburb ?? "").trim();
  const postcodeFilter = (searchParams?.postcode ?? "").trim();
  const radiusFilter = (searchParams?.radius_km ?? "").trim();
  const sort = (searchParams?.sort ?? "").trim();
  const minPriceFilter = (searchParams?.min_price ?? "").trim();
  const maxPriceFilter = (searchParams?.max_price ?? "").trim();
  const bedroomsFilter = (searchParams?.bedrooms ?? "").trim();
  const bathroomsFilter = (searchParams?.bathrooms ?? "").trim();
  const propertyTypeFilter = (searchParams?.property_type ?? "").trim();

  // Exclude listings that already have an associated job (assigned/approved).
  // Use admin client so we see ALL jobs (RLS would otherwise hide jobs the user isn't part of).
  const admin = createSupabaseAdminClient();
  const jobsClient = (admin ?? supabase) as SupabaseClient<Database>;
  const { data: jobsData } = await jobsClient
    .from("jobs")
    .select("listing_id");

  const takenIds = (jobsData ?? []).map((j: { listing_id: string | number }) => j.listing_id) as (string | number)[];

  const filters = {
    suburb: suburbFilter || undefined,
    postcode: postcodeFilter || undefined,
    sort: sort || undefined,
    min_price: minPriceFilter || undefined,
    max_price: maxPriceFilter || undefined,
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
  const centerLat = searchParams?.center_lat ? Number(searchParams.center_lat) : null;
  const centerLon = searchParams?.center_lon ? Number(searchParams.center_lon) : null;

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
  if (searchParams?.center_lat) baseParams.set("center_lat", searchParams.center_lat);
  if (searchParams?.center_lon) baseParams.set("center_lon", searchParams.center_lon);
  if (minPriceFilter) baseParams.set("min_price", minPriceFilter);
  if (maxPriceFilter) baseParams.set("max_price", maxPriceFilter);
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
    ...(bedroomsFilter && bedroomsFilter !== "any" && { bedrooms: bedroomsFilter }),
    ...(bathroomsFilter && bathroomsFilter !== "any" && { bathrooms: bathroomsFilter }),
    ...(propertyTypeFilter && propertyTypeFilter !== "any" && { property_type: propertyTypeFilter }),
  }).toString();

  return (
    <JobsPageMobileShell>
    <OfflineJobsPrimer jobsListQuery={jobsListQuery}>
    <section className="page-inner space-y-6">
      <Card className="overflow-hidden border border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/80 shadow-lg dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
        <CardHeader className="gap-2 pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg font-bold leading-tight text-foreground md:text-2xl dark:text-gray-100">
                Find bond cleans
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground dark:text-gray-400">
                Search by area and distance — refine price & property in{" "}
                <span className="font-medium text-foreground dark:text-gray-300">More filters</span>.
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold tabular-nums dark:bg-gray-800 dark:text-gray-100"
            >
              {initialListings.length} found
            </Badge>
          </div>
          {(suburbFilter || postcodeFilter || radiusFilter) && (
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              ~{activeRadiusKm} km of{" "}
              <span className="font-medium text-foreground dark:text-gray-300">
                {[suburbFilter, postcodeFilter].filter(Boolean).join(" ") || "your search"}
              </span>
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="space-y-2">
            <FindJobsSearch
              variant="jobs"
              defaultRadiusKm={defaultRadiusKm}
              initial={{
                suburb: suburbFilter,
                postcode: postcodeFilter,
                radius_km: radiusFilter,
                center_lat: searchParams?.center_lat,
                center_lon: searchParams?.center_lon,
                sort: sort || undefined,
                min_price: minPriceFilter,
                max_price: maxPriceFilter,
                bedrooms: bedroomsFilter,
                bathrooms: bathroomsFilter,
                property_type: propertyTypeFilter,
              }}
            />
            {(suburbFilter ||
              postcodeFilter ||
              radiusFilter ||
              minPriceFilter ||
              maxPriceFilter ||
              (bedroomsFilter && bedroomsFilter !== "any") ||
              (bathroomsFilter && bathroomsFilter !== "any") ||
              (propertyTypeFilter && propertyTypeFilter !== "any")) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                  Active:
                </span>
                {minPriceFilter || maxPriceFilter ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-gray-600 text-xs text-foreground dark:border-gray-500 dark:text-gray-200"
                  >
                    ${minPriceFilter || "0"}–${maxPriceFilter || "∞"}
                  </Badge>
                ) : null}
                {bedroomsFilter && bedroomsFilter !== "any" && (
                  <Badge variant="outline" className="rounded-full border-gray-600 text-xs dark:border-gray-500 dark:text-gray-200">
                    {Number(bedroomsFilter) >= 5 ? "5+ bed" : `${bedroomsFilter} bed`}
                  </Badge>
                )}
                {bathroomsFilter && bathroomsFilter !== "any" && (
                  <Badge variant="outline" className="rounded-full border-gray-600 text-xs dark:border-gray-500 dark:text-gray-200">
                    {Number(bathroomsFilter) >= 4 ? "4+ bath" : `${bathroomsFilter} bath`}
                  </Badge>
                )}
                {propertyTypeFilter && propertyTypeFilter !== "any" && (
                  <Badge variant="outline" className="rounded-full border-gray-600 text-xs capitalize dark:border-gray-500 dark:text-gray-200">
                    {propertyTypeFilter}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-8 rounded-full text-xs text-muted-foreground dark:text-gray-400 dark:hover:text-gray-100"
                  asChild
                >
                  <Link href={clearHref}>Clear all</Link>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
          filters={{
            suburb: suburbFilter || undefined,
            postcode: postcodeFilter || undefined,
            sort: sort || undefined,
            min_price: minPriceFilter || undefined,
            max_price: maxPriceFilter || undefined,
            bedrooms: bedroomsFilter || undefined,
            bathrooms: bathroomsFilter || undefined,
            property_type: propertyTypeFilter || undefined,
          }}
        />
      )}
    </section>
    </OfflineJobsPrimer>
    </JobsPageMobileShell>
  );
}
