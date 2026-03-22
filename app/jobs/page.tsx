import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { buildLiveListingsQuery } from "@/lib/jobs-query";
import { buildListerCardDataByListingId } from "@/lib/lister-card-data";
import { JobsList } from "@/components/features/jobs-list";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-emerald-50 via-white to-sky-50 shadow-xl dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 dark:border dark:border-gray-800">
        <CardHeader className="gap-1 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-semibold md:text-3xl dark:text-gray-100">
                Find local bond cleans to bid on
              </CardTitle>
              <CardDescription className="text-sm md:text-base dark:text-gray-400">
                Browse live Bond Back listings near you. Filter by suburb, postcode, price and
                property details to find the right jobs.
              </CardDescription>
              {(suburbFilter || postcodeFilter || radiusFilter) && (
                <p className="mt-1 text-xs text-muted-foreground dark:text-gray-400">
                  Showing {initialListings.length} bond clean
                  {initialListings.length === 1 ? "" : "s"} within approximately{" "}
                  {activeRadiusKm}km of{" "}
                  {[suburbFilter, postcodeFilter].filter(Boolean).join(" ") || "your search"}.
                </p>
              )}
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground md:items-end dark:text-gray-400">
              <span className="text-xs uppercase tracking-wide">
                {initialListings.length} bond cleans found
              </span>
              <form
                action="/jobs"
                method="GET"
                className="flex items-center gap-2 text-xs"
              >
                {/* Preserve existing filters when sorting */}
                {suburbFilter && <input type="hidden" name="suburb" value={suburbFilter} />}
                {postcodeFilter && <input type="hidden" name="postcode" value={postcodeFilter} />}
                {radiusFilter && <input type="hidden" name="radius_km" value={radiusFilter} />}
                {searchParams?.center_lat && (
                  <input type="hidden" name="center_lat" value={searchParams.center_lat} />
                )}
                {searchParams?.center_lon && (
                  <input type="hidden" name="center_lon" value={searchParams.center_lon} />
                )}
                {minPriceFilter && (
                  <input type="hidden" name="min_price" value={minPriceFilter} />
                )}
                {maxPriceFilter && (
                  <input type="hidden" name="max_price" value={maxPriceFilter} />
                )}
                {bedroomsFilter && (
                  <input type="hidden" name="bedrooms" value={bedroomsFilter} />
                )}
                {bathroomsFilter && (
                  <input type="hidden" name="bathrooms" value={bathroomsFilter} />
                )}
                {propertyTypeFilter && (
                  <input type="hidden" name="property_type" value={propertyTypeFilter} />
                )}
                <label
                  htmlFor="sort"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400"
                >
                  Sort
                </label>
                <Select name="sort" defaultValue={sort || "ending-soon"}>
                  <SelectTrigger id="sort" className="h-8 w-48 text-xs">
                    <SelectValue placeholder="Ending soon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ending-soon">Ending soon</SelectItem>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="price-asc">Price low to high</SelectItem>
                    <SelectItem value="price-desc">Price high to low</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" variant="outline" className="h-8 px-3 text-xs">
                  Apply
                </Button>
              </form>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Filter bar — sticky on mobile, hides on scroll down */}
          <div data-sticky-filter className="pb-2 transition-transform duration-300 md:pb-0">
          <form
            action="/jobs"
            method="GET"
            className="flex flex-col gap-3 md:flex-row md:items-end"
            aria-label="Filter jobs by suburb, postcode, and more"
          >
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="suburb"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400"
            >
              Suburb
            </label>
            <Input
              id="suburb"
              name="suburb"
              defaultValue={suburbFilter}
              placeholder="e.g. LITTLE MOUNTAIN"
            />
          </div>
          <div className="w-full space-y-1.5 md:w-40">
            <label
              htmlFor="postcode"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400"
            >
              Postcode
            </label>
            <Input
              id="postcode"
              name="postcode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              defaultValue={postcodeFilter}
              placeholder="4551"
            />
          </div>
          {/* Simple advanced filters */}
          <div className="flex flex-1 flex-wrap gap-3 text-xs text-muted-foreground dark:text-gray-400">
            <div className="w-full space-y-1.5 md:w-32">
              <label
                htmlFor="min_price"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400"
              >
                Min price ($)
              </label>
              <Input
                id="min_price"
                name="min_price"
                type="number"
                min={0}
                defaultValue={minPriceFilter}
                placeholder="0"
                className="h-8"
              />
            </div>
            <div className="w-full space-y-1.5 md:w-32">
              <label
                htmlFor="max_price"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400"
              >
                Max price ($)
              </label>
              <Input
                id="max_price"
                name="max_price"
                type="number"
                min={0}
                defaultValue={maxPriceFilter}
                placeholder="1000"
                className="h-8"
              />
            </div>
            <div className="w-full space-y-1.5 md:w-28">
              <label
                htmlFor="bedrooms"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400"
              >
                Bedrooms
              </label>
              <Select name="bedrooms" defaultValue={bedroomsFilter || "any"}>
                <SelectTrigger id="bedrooms" className="h-8 text-xs">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-1.5 md:w-28">
              <label
                htmlFor="bathrooms"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400"
              >
                Bathrooms
              </label>
              <Select name="bathrooms" defaultValue={bathroomsFilter || "any"}>
                <SelectTrigger id="bathrooms" className="h-8 text-xs">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-1.5 md:w-40">
              <label
                htmlFor="property_type"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400"
              >
                Property type
              </label>
              <Select name="property_type" defaultValue={propertyTypeFilter || "any"}>
                <SelectTrigger id="property_type" className="h-8 text-xs">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="Apartment">Apartment</SelectItem>
                  <SelectItem value="House">House</SelectItem>
                  <SelectItem value="Townhouse">Townhouse</SelectItem>
                  <SelectItem value="Unit">Unit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-end md:justify-end">
            <div className="flex flex-1 flex-wrap items-center gap-2 text-xs text-muted-foreground dark:text-gray-400 md:justify-end">
              {minPriceFilter || maxPriceFilter ? (
                <Badge variant="outline">
                  Price{" "}
                  {minPriceFilter && `from $${minPriceFilter}`}
                  {minPriceFilter && maxPriceFilter && " "}
                  {maxPriceFilter && `to $${maxPriceFilter}`}
                </Badge>
              ) : null}
              {bedroomsFilter && bedroomsFilter !== "any" && (
                <Badge variant="outline">
                  {Number(bedroomsFilter) >= 5 ? "5+ bedrooms" : `${bedroomsFilter} bedrooms`}
                </Badge>
              )}
              {bathroomsFilter && bathroomsFilter !== "any" && (
                <Badge variant="outline">
                  {Number(bathroomsFilter) >= 4 ? "4+ bathrooms" : `${bathroomsFilter} bathrooms`}
                </Badge>
              )}
              {propertyTypeFilter && propertyTypeFilter !== "any" && (
                <Badge variant="outline">{propertyTypeFilter}</Badge>
              )}
            </div>
            <div className="flex w-full gap-2 md:w-auto md:justify-end">
              <Button
                type="submit"
                className="w-full md:w-auto"
              >
                Search
              </Button>
              {(suburbFilter ||
                postcodeFilter ||
                radiusFilter ||
                minPriceFilter ||
                maxPriceFilter ||
                (bedroomsFilter && bedroomsFilter !== "any") ||
                (bathroomsFilter && bathroomsFilter !== "any") ||
                (propertyTypeFilter && propertyTypeFilter !== "any")) && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full md:w-auto"
                  asChild
                >
                  <Link href={clearHref}>Clear all</Link>
                </Button>
              )}
            </div>
          </div>
          </form>
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
