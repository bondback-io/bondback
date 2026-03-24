import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSuburbLatLon } from "@/lib/geo/suburb-lat-lon";
import { loadBrowseCleaners } from "@/lib/data/browse-cleaners";
import { CLEANER_TIER_META } from "@/lib/cleaner-browse-tier";
import {
  BrowseCleanersSearch,
  type BrowseCleanersSearchInitial,
} from "@/components/features/browse-cleaners-search";
import { BrowseCleanerCard } from "@/components/features/browse-cleaner-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Info } from "lucide-react";

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

  const radiusParsed = resolved.radius_km?.trim()
    ? Number(resolved.radius_km)
    : NaN;
  const radiusKm = Number.isFinite(radiusParsed) && radiusParsed > 0
    ? Math.min(100, Math.max(5, Math.round(radiusParsed)))
    : defaultRadiusKm;

  let centerLat: number | null = resolved.center_lat ? Number(resolved.center_lat) : null;
  let centerLon: number | null = resolved.center_lon ? Number(resolved.center_lon) : null;

  if (
    centerLat == null ||
    centerLon == null ||
    !Number.isFinite(centerLat) ||
    !Number.isFinite(centerLon)
  ) {
    const pcRaw =
      (resolved.postcode ?? profile?.postcode ?? "").replace(/\D/g, "").slice(0, 4) || "";
    if (pcRaw.length >= 4) {
      const admin = createSupabaseAdminClient();
      const ll = await getSuburbLatLon((admin ?? supabase) as Parameters<typeof getSuburbLatLon>[0], pcRaw);
      if (ll) {
        centerLat = ll.lat;
        centerLon = ll.lon;
      }
    }
  }

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

  const searchInitial: BrowseCleanersSearchInitial = {
    suburb: resolved.suburb ?? profile?.suburb ?? "",
    postcode: resolved.postcode ?? profile?.postcode ?? "",
    radius_km: String(radiusKm),
    center_lat: hasCenter && centerLat != null ? String(centerLat) : "",
    center_lon: hasCenter && centerLon != null ? String(centerLon) : "",
  };

  return (
    <main className="page-inner space-y-8 pb-16">
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
            Compare verified professionals near you — tiers, ratings, badges, and job history help you
            choose with confidence.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/50 shadow-md dark:border-gray-800 dark:from-emerald-950/30 dark:via-gray-950 dark:to-sky-950/20">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-lg text-foreground dark:text-gray-100 sm:text-xl">
            Search near you
          </CardTitle>
          <CardDescription className="text-base dark:text-gray-400">
            Use your suburb or &ldquo;Near me&rdquo; to set a centre point. Results are filtered by your
            radius (from your profile by default).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <BrowseCleanersSearch initial={searchInitial} defaultRadiusKm={defaultRadiusKm} />
        </CardContent>
      </Card>

      {!centerResolved && (
        <div
          className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100 sm:text-base"
          role="status"
        >
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <p>
            <span className="font-semibold">Showing all cleaners.</span> Set your suburb or use
            &ldquo;Near me&rdquo; to filter by distance ({radiusKm} km radius when a location is set).
          </p>
        </div>
      )}

      {centerResolved && (
        <p className="text-sm text-muted-foreground dark:text-gray-400 sm:text-base">
          Showing cleaners within <span className="font-semibold text-foreground dark:text-gray-200">{radiusKm} km</span>{" "}
          of your search area ({cleaners.length} {cleaners.length === 1 ? "result" : "results"}).
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
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center dark:bg-gray-900/40">
          <p className="text-base font-medium text-foreground dark:text-gray-100 sm:text-lg">
            No cleaners found in this radius.
          </p>
          <p className="mt-2 text-sm text-muted-foreground dark:text-gray-400 sm:text-base">
            Try increasing the distance or clearing the suburb to see cleaners across Australia.
          </p>
        </div>
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
        Levels are based on completed jobs, ratings, verification badges, and profile completeness (ABN,
        insurance, portfolio).{" "}
        <Link href="/help" className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
          Help centre
        </Link>
      </p>
    </main>
  );
}
