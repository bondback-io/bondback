import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLatLonForCleanerProfile } from "@/lib/geo/suburb-lat-lon";
import { haversineKm } from "@/lib/geo/haversine-km";
import {
  computeCleanerBrowseTier,
  tierSortRank,
  type CleanerBrowseTier,
} from "@/lib/cleaner-browse-tier";
import { MAX_TRAVEL_KM } from "@/lib/max-travel-km";
import { fetchVisibleCleanerReviewAggregatesByCleanerIds } from "@/lib/reviews/fetch-visible-cleaner-review-aggregates";
import { effectiveProfilePhotoUrl } from "@/lib/profile-display-photo";

export type BrowseCleanerRow = {
  id: string;
  fullName: string | null;
  businessName: string | null;
  profilePhotoUrl: string | null;
  suburb: string | null;
  postcode: string | null;
  state: string | null;
  bio: string | null;
  yearsExperience: number | null;
  verificationBadges: string[];
  hasAbn: boolean;
  hasInsurance: boolean;
  portfolioPhotoUrls: string[];
  avgRating: number | null;
  reviewCount: number;
  completedJobs: number;
  tier: CleanerBrowseTier;
  distanceKm: number | null;
};

type RawProfile = {
  id: string;
  full_name: string | null;
  business_name: string | null;
  profile_photo_url: string | null;
  avatar_url: string | null;
  suburb: string | null;
  postcode: string | null;
  state: string | null;
  bio: string | null;
  years_experience: number | null;
  verification_badges: string[] | null;
  abn: string | null;
  insurance_policy_number: string | null;
  portfolio_photo_urls: string[] | null;
  /** `text[]` in Postgres, or legacy `text` / JSON string — see `normalizeProfileRoles` */
  roles: unknown;
  is_deleted: boolean | null;
};

/**
 * Normalize `profiles.roles` whether the DB column is `text[]`, `text` holding JSON, or comma-separated text.
 * (`.contains("roles", …)` requires `text[]` and fails with `text @> unknown` on a plain `text` column.)
 */
function normalizeProfileRoles(roles: unknown): string[] {
  if (Array.isArray(roles)) {
    return roles.filter((r): r is string => typeof r === "string");
  }
  if (typeof roles === "string") {
    const t = roles.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((r): r is string => typeof r === "string");
        }
      } catch {
        /* fall through */
      }
    }
    return t
      .split(/[,]+/)
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return [];
}

export async function loadBrowseCleaners(params: {
  /** Lister/cleaner “search near me” radius (km) */
  radiusKm: number;
  centerLat: number | null;
  centerLon: number | null;
}): Promise<{
  cleaners: BrowseCleanerRow[];
  centerResolved: boolean;
}> {
  const supabase = await createServerSupabaseClient();
  const admin = createSupabaseAdminClient();
  const client = (admin ?? supabase) as SupabaseClient<any>;

  const { data: profileRows, error } = await client
    .from("profiles")
    .select(
      "id, full_name, business_name, profile_photo_url, avatar_url, suburb, postcode, state, bio, years_experience, verification_badges, abn, insurance_policy_number, portfolio_photo_urls, roles, is_deleted"
    );

  if (error) {
    console.error("browse-cleaners profiles", error.message);
    return { cleaners: [], centerResolved: false };
  }

  const raw = (profileRows ?? []) as RawProfile[];
  const cleanersOnly = raw.filter((p) => {
    if (p.is_deleted === true) return false;
    return normalizeProfileRoles(p.roles).includes("cleaner");
  });

  const liveReviewAgg = await fetchVisibleCleanerReviewAggregatesByCleanerIds(
    client,
    cleanersOnly.map((p) => p.id)
  );

  const winnerIds = cleanersOnly.map((p) => p.id);
  const completedCountByWinner = new Map<string, number>();

  if (winnerIds.length > 0) {
    const { data: jobRows } = await client
      .from("jobs")
      .select("winner_id")
      .eq("status", "completed")
      .in("winner_id", winnerIds);
    for (const row of jobRows ?? []) {
      const w = (row as { winner_id?: string | null }).winner_id;
      if (!w) continue;
      completedCountByWinner.set(w, (completedCountByWinner.get(w) ?? 0) + 1);
    }
  }

  const geoCache = new Map<string, { lat: number; lon: number } | null>();

  async function latLonForCleaner(p: RawProfile): Promise<{
    lat: number;
    lon: number;
  } | null> {
    const key = `${(p.suburb ?? "").trim().toLowerCase()}|${(p.postcode ?? "").replace(/\D/g, "").slice(0, 4)}`;
    if (geoCache.has(key)) return geoCache.get(key) ?? null;
    const ll = await getLatLonForCleanerProfile(client, p.suburb, p.postcode);
    geoCache.set(key, ll);
    return ll;
  }

  const viewerLat = params.centerLat;
  const viewerLon = params.centerLon;

  const hasCenter =
    viewerLat != null &&
    viewerLon != null &&
    Number.isFinite(viewerLat) &&
    Number.isFinite(viewerLon);

  const centerResolved = hasCenter;

  const radius = Math.min(MAX_TRAVEL_KM, Math.max(5, Math.round(params.radiusKm)));

  const mapped: BrowseCleanerRow[] = [];

  for (const p of cleanersOnly) {
    const portfolioUrls = Array.isArray(p.portfolio_photo_urls)
      ? p.portfolio_photo_urls.filter((u): u is string => typeof u === "string" && u.length > 0)
      : [];
    const abnDigits = (p.abn ?? "").replace(/\D/g, "");
    const hasAbn = abnDigits.length === 11;
    const hasInsurance = ((p.insurance_policy_number ?? "").trim().length ?? 0) > 0;

    const completedJobs = completedCountByWinner.get(p.id) ?? 0;
    const live = liveReviewAgg.get(p.id) ?? { count: 0, avg: null };
    const reviewCount = live.count;
    const avgRating = live.count > 0 && live.avg != null ? live.avg : null;

    const tier = computeCleanerBrowseTier({
      completedJobs,
      avgRating,
      reviewCount,
      badges: p.verification_badges,
      hasAbn,
      hasInsurance,
      portfolioPhotoCount: portfolioUrls.length,
    });

    let distanceKm: number | null = null;
    if (hasCenter && viewerLat != null && viewerLon != null) {
      const c = await latLonForCleaner(p);
      if (c) {
        distanceKm = haversineKm(viewerLat, viewerLon, c.lat, c.lon);
      }
    }

    mapped.push({
      id: p.id,
      fullName: p.full_name,
      businessName: p.business_name,
      profilePhotoUrl: effectiveProfilePhotoUrl({
        profile_photo_url: p.profile_photo_url,
        avatar_url: p.avatar_url,
      }),
      suburb: p.suburb,
      postcode: p.postcode,
      state: p.state,
      bio: p.bio,
      yearsExperience: p.years_experience,
      verificationBadges: Array.isArray(p.verification_badges) ? p.verification_badges : [],
      hasAbn,
      hasInsurance,
      portfolioPhotoUrls: portfolioUrls.slice(0, 6),
      avgRating,
      reviewCount,
      completedJobs,
      tier,
      distanceKm,
    });
  }

  const filtered = hasCenter
    ? mapped.filter((m) => {
        if (m.distanceKm == null) return true;
        return m.distanceKm <= radius;
      })
    : mapped;

  filtered.sort((a, b) => {
    const t = tierSortRank(a.tier) - tierSortRank(b.tier);
    if (t !== 0) return t;
    const da = a.distanceKm;
    const db = b.distanceKm;
    if (da != null && db != null && da !== db) return da - db;
    if (da != null && db == null) return -1;
    if (da == null && db != null) return 1;
    const ra = a.avgRating ?? -1;
    const rb = b.avgRating ?? -1;
    if (rb !== ra) return rb - ra;
    return b.completedJobs - a.completedJobs;
  });

  return { cleaners: filtered, centerResolved };
}
