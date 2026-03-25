import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveBrowseCleanersSearchCenter } from "@/lib/geo/suburb-lat-lon";
import { loadBrowseCleaners } from "@/lib/data/browse-cleaners";
import { CLEANER_TIER_META } from "@/lib/cleaner-browse-tier";
import { BrowseCleanerCard } from "@/components/features/browse-cleaner-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info, SearchX } from "lucide-react";
import { JobsPageMobileShell } from "@/components/features/jobs-page-mobile-shell";
import { CleanersPageMobileChrome } from "@/components/mobile-job-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse cleaners",
  description:
    "Discover verified bond cleaners near you — ratings, badges, completed jobs, and profile snapshots on Bond Back.",
  alternates: { canonical: "/cleaners" },
  robots: { index: false, follow: true },
};

type CleanersSearchParams = {
  suburb?: string;
  postcode?: string;
  radius_km?: string;
  center_lat?: string;
  center_lon?: string;
};

export default async function BrowseCleanersPage({
  searchParams,
}: {
  searchParams?: Promise<CleanersSearchParams>;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const resolved = searchParams ? await searchParams : {};

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("max_travel_km, suburb, postcode, roles, active_role")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = profileRow as {
    max_travel_km?: number | null;
    suburb?: string | null;
    postcode?: string | null;
    roles?: string[] | null;
    active_role?: string | null;
  } | null;

  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  const activeRole =
    profile?.active_role === "lister" || profile?.active_role === "cleaner"
      ? profile.active_role
      : null;
  const dashboardHref =
    activeRole === "cleaner"
      ? "/cleaner/dashboard"
      : activeRole === "lister"
        ? "/lister/dashboard"
        : roles.includes("lister")
          ? "/lister/dashboard"
          : roles.includes("cleaner")
            ? "/cleaner/dashboard"
            : "/dashboard";

  const defaultRadiusKm =
    typeof profile?.max_travel_km === "number" && profile.max_travel_km > 0
      ? profile.max_travel_km
      : 30;

  const suburbFilter = (resolved.suburb ?? "").trim();
  const postcodeFilter = (resolved.postcode ?? "").trim();
  const radiusFilter = (resolved.radius_km ?? "").trim();

  const radiusParsed = radiusFilter ? Number(radiusFilter) : NaN;
  const radiusKm = Number.isFinite(radiusParsed) && radiusParsed > 0
    ? Math.min(100, Math.max(5, Math.round(radiusParsed)))
    : Math.min(100, Math.max(5, Math.round(defaultRadiusKm)));

  const centerLatRaw = resolved.center_lat ? Number(resolved.center_lat) : null;
  const centerLonRaw = resolved.center_lon ? Number(resolved.center_lon) : null;

  const adminClient = createSupabaseAdminClient();
  const supabaseForGeo = (adminClient ?? supabase) as Parameters<
    typeof resolveBrowseCleanersSearchCenter
  >[0];

  const resolvedCenter = await resolveBrowseCleanersSearchCenter(supabaseForGeo, {
    centerLat:
      centerLatRaw != null && Number.isFinite(centerLatRaw) ? centerLatRaw : null,
    centerLon:
      centerLonRaw != null && Number.isFinite(centerLonRaw) ? centerLonRaw : null,
    suburbFilter,
    postcodeFilter,
    profilePostcode: profile?.postcode ?? null,
  });

  const centerLat = resolvedCenter?.lat ?? null;
  const centerLon = resolvedCenter?.lon ?? null;

  const hasCenter =
    centerLat != null &&
    centerLon != null &&
    Number.isFinite(centerLat) &&
    Number.isFinite(centerLon);

  const { cleaners, centerResolved } = await loadBrowseCleaners({
    viewerUserId: session.user.id,
    radiusKm,
    centerLat: hasCenter ? centerLat : null,
    centerLon: hasCenter ? centerLon : null,
  });

  const baseParams = new URLSearchParams();
  if (suburbFilter) baseParams.set("suburb", suburbFilter);
  if (postcodeFilter) baseParams.set("postcode", postcodeFilter);
  if (radiusFilter) baseParams.set("radius_km", radiusFilter);
  if (resolved.center_lat) baseParams.set("center_lat", resolved.center_lat);
  if (resolved.center_lon) baseParams.set("center_lon", resolved.center_lon);

  const clearHref = "/cleaners";
  const currentRadiusForIncrease = Number(radiusFilter || defaultRadiusKm);
  const nextRadiusForIncrease =
    currentRadiusForIncrease < 20 ? 20 : currentRadiusForIncrease < 50 ? 50 : 100;
  const radiusParams = new URLSearchParams(baseParams);
  radiusParams.set("radius_km", String(nextRadiusForIncrease));
  const increaseRadiusHref = `/cleaners?${radiusParams.toString()}`;

  return (
    <JobsPageMobileShell>
      <Suspense fallback={null}>
        <CleanersPageMobileChrome
          initialResultCount={cleaners.length}
          defaultRadiusKm={defaultRadiusKm}
          profileSuburb={profile?.suburb ?? null}
          initialSuburb={suburbFilter || profile?.suburb || ""}
          initialPostcode={postcodeFilter || profile?.postcode || ""}
          initialRadiusKm={radiusKm}
          initialCenterLat={hasCenter ? centerLat : null}
          initialCenterLon={hasCenter ? centerLon : null}
        >
          <main className="page-inner space-y-6 pb-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link
                  href={dashboardHref}
                  className="mb-2 inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-100"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  Back to dashboard
                </Link>
                <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground dark:text-gray-50 sm:text-3xl">
                  Browse cleaners
                </h1>
                <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground dark:text-gray-400 sm:text-lg">
                  Compare verified professionals near you — use the search bar above to filter by
                  distance, same as Find Jobs.
                </p>
              </div>
            </div>

            {!centerResolved && (
              <div
                className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100 sm:text-base"
                role="status"
              >
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                <p>
                  <span className="font-semibold">Showing all cleaners.</span> Set your suburb or use
                  &ldquo;Near me&rdquo; in the search bar to filter by distance ({radiusKm} km radius when a
                  location is set).
                </p>
              </div>
            )}

            {centerResolved && (
              <p className="text-sm text-muted-foreground dark:text-gray-400 sm:text-base">
                Showing cleaners within{" "}
                <span className="font-semibold text-foreground dark:text-gray-200">{radiusKm} km</span>{" "}
                of your search area ({cleaners.length}{" "}
                {cleaners.length === 1 ? "result" : "results"}).
              </p>
            )}

            <section aria-labelledby="tier-legend-heading">
              <h2 id="tier-legend-heading" className="sr-only">
                Cleaner levels
              </h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                {(Object.keys(CLEANER_TIER_META) as Array<keyof typeof CLEANER_TIER_META>).map(
                  (key) => {
                    const m = CLEANER_TIER_META[key];
                    return (
                      <Badge
                        key={key}
                        variant="outline"
                        className={`min-h-[40px] justify-center px-3 py-1.5 text-sm font-semibold ${m.className}`}
                      >
                        <span className="mr-1.5 font-bold">{m.short}:</span>
                        <span className="font-normal opacity-90">
                          {key === "elite" && "Strong history, ratings & trust signals"}
                          {key === "pro" && "Established track record or solid profile"}
                          {key === "rising" && "Newer on the platform — still building history"}
                        </span>
                      </Badge>
                    );
                  }
                )}
              </div>
            </section>

            {cleaners.length === 0 ? (
              <Card className="mt-2 border-dashed bg-card/80 text-center shadow-md dark:border-gray-700 dark:bg-gray-900">
                <CardHeader className="space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted dark:bg-gray-800">
                    <SearchX className="h-6 w-6 text-muted-foreground dark:text-gray-400" />
                  </div>
                  <CardTitle className="text-lg dark:text-gray-100">
                    No cleaners found in this area
                  </CardTitle>
                  <CardDescription className="text-sm dark:text-gray-400">
                    Try widening your search radius or choosing a nearby suburb.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-1 text-xs text-muted-foreground dark:text-gray-400">
                    <li>• Increase the radius from the search bar</li>
                    <li>• Broaden your suburb or postcode</li>
                    <li>• Clear filters to see cleaners across Australia</li>
                  </ul>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href={clearHref}>Clear filters</Link>
                    </Button>
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href={increaseRadiusHref}>Increase radius</Link>
                    </Button>
                    <Button type="button" size="sm" asChild>
                      <Link href="/jobs">Browse jobs</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <ul className="grid list-none gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {cleaners.map((c) => (
                  <li key={c.id}>
                    <BrowseCleanerCard cleaner={c} />
                  </li>
                ))}
              </ul>
            )}

            <p className="text-center text-xs text-muted-foreground dark:text-gray-500 sm:text-sm">
              Levels are based on completed jobs, ratings, verification badges, and profile completeness
              (ABN, insurance, portfolio).{" "}
              <Link
                href="/help"
                className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
              >
                Help centre
              </Link>
            </p>
          </main>
        </CleanersPageMobileChrome>
      </Suspense>
    </JobsPageMobileShell>
  );
}
