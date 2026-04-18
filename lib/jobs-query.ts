/**
 * Shared query builder for jobs/listings list (SSR and load-more action).
 * Keeps filter/sort logic in one place for consistency.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { LISTING_FULL_SELECT } from "@/lib/supabase/queries";
import { parseUtcTimestamp } from "@/lib/utils";

export type JobsListFilters = {
  suburb?: string;
  postcode?: string;
  sort?: string;
  min_price?: string;
  max_price?: string;
  /** Min latest bid (AUD whole dollars), maps to `current_lowest_bid_cents` */
  min_bid_price?: string;
  /** Max latest bid (AUD whole dollars), maps to `current_lowest_bid_cents` */
  max_bid_price?: string;
  /** When truthy (e.g. `"1"`), only listings with buy-now set */
  buy_now_only?: string;
  bedrooms?: string;
  bathrooms?: string;
  property_type?: string;
};

/** Accepts SSR or browser Supabase client (schema generic may differ slightly between packages). */
export function buildLiveListingsQuery(
  supabase: SupabaseClient<Database, "public", any>,
  filters: JobsListFilters,
  takenIds: (string | number)[]
) {
  const now = new Date().toISOString();
  const suburbFilter = (filters.suburb ?? "").trim();
  const postcodeFilter = (filters.postcode ?? "").trim();
  const sort = (filters.sort ?? "").trim();
  const minPriceFilter = (filters.min_price ?? "").trim();
  const maxPriceFilter = (filters.max_price ?? "").trim();
  const minBidPriceFilter = (filters.min_bid_price ?? "").trim();
  const maxBidPriceFilter = (filters.max_bid_price ?? "").trim();
  const buyNowOnlyFilter = (filters.buy_now_only ?? "").trim();
  const bedroomsFilter = (filters.bedrooms ?? "").trim();
  const bathroomsFilter = (filters.bathrooms ?? "").trim();
  const propertyTypeFilter = (filters.property_type ?? "").trim();

  let query = supabase
    .from("listings")
    .select(LISTING_FULL_SELECT)
    .eq("status", "live")
    .is("cancelled_early_at", null)
    .gt("end_time", now);

  if (takenIds.length > 0) {
    const list = takenIds.map((id) => String(id)).join(",");
    query = query.not("id", "in", `(${list})`);
  }

  if (suburbFilter || postcodeFilter) {
    const orParts: string[] = [];
    if (postcodeFilter) orParts.push(`postcode.eq.${postcodeFilter}`);
    if (suburbFilter) orParts.push(`suburb.ilike.%${suburbFilter}%`);
    if (orParts.length > 0) query = query.or(orParts.join(","));
  }

  if (minPriceFilter) {
    const minCents = Number(minPriceFilter) * 100;
    if (!Number.isNaN(minCents)) query = query.gte("reserve_cents", minCents);
  }
  if (maxPriceFilter) {
    const maxCents = Number(maxPriceFilter) * 100;
    if (!Number.isNaN(maxCents)) query = query.lte("reserve_cents", maxCents);
  }
  if (minBidPriceFilter) {
    const minCents = Number(minBidPriceFilter) * 100;
    if (!Number.isNaN(minCents)) query = query.gte("current_lowest_bid_cents", minCents);
  }
  if (maxBidPriceFilter) {
    const maxCents = Number(maxBidPriceFilter) * 100;
    if (!Number.isNaN(maxCents)) query = query.lte("current_lowest_bid_cents", maxCents);
  }
  if (buyNowOnlyFilter && buyNowOnlyFilter !== "0" && buyNowOnlyFilter.toLowerCase() !== "false") {
    query = query.gt("buy_now_cents", 0);
  }
  if (bedroomsFilter) {
    const beds = Number(bedroomsFilter);
    if (!Number.isNaN(beds) && beds > 0) {
      if (beds >= 5) query = query.gte("bedrooms", 5);
      else query = query.eq("bedrooms", beds);
    }
  }
  if (bathroomsFilter) {
    const baths = Number(bathroomsFilter);
    if (!Number.isNaN(baths) && baths > 0) {
      if (baths >= 4) query = query.gte("bathrooms", 4);
      else query = query.eq("bathrooms", baths);
    }
  }
  if (propertyTypeFilter && propertyTypeFilter.toLowerCase() !== "any") {
    query = query.eq("property_type", propertyTypeFilter);
  }

  switch (sort) {
    case "price-asc":
      query = query.order("reserve_cents", { ascending: true, nullsFirst: true });
      break;
    case "price-desc":
      query = query.order("reserve_cents", { ascending: false, nullsFirst: false });
      break;
    case "ending-soon":
      query = query.order("end_time", { ascending: true });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("end_time", { ascending: true });
      break;
  }

  return query;
}

/** Row shape needed to mirror `buildLiveListingsQuery` predicates (realtime + client filtering). */
export type ListingFilterRow = {
  status?: string | null;
  cancelled_early_at?: string | null;
  end_time?: string | null;
  suburb?: string | null;
  postcode?: string | null;
  reserve_cents?: number | null;
  current_lowest_bid_cents?: number | null;
  buy_now_cents?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  property_type?: string | null;
};

/**
 * True when a listing row would be included by `buildLiveListingsQuery` with the same filters
 * (used to ignore irrelevant realtime events when search filters are active).
 */
export function listingMatchesJobsListFilters(
  row: ListingFilterRow,
  filters: JobsListFilters
): boolean {
  if (String(row.status ?? "").toLowerCase() !== "live") return false;
  if (row.cancelled_early_at != null && String(row.cancelled_early_at).trim() !== "") {
    return false;
  }
  if (
    !row.end_time ||
    parseUtcTimestamp(String(row.end_time)) <= Date.now()
  ) {
    return false;
  }

  const suburbFilter = (filters.suburb ?? "").trim();
  const postcodeFilter = (filters.postcode ?? "").trim();
  if (suburbFilter || postcodeFilter) {
    let matches = false;
    if (postcodeFilter && String(row.postcode ?? "").trim() === postcodeFilter) {
      matches = true;
    }
    if (suburbFilter) {
      const s = String(row.suburb ?? "").toLowerCase();
      if (s.includes(suburbFilter.toLowerCase())) matches = true;
    }
    if (!matches) return false;
  }

  const minPriceFilter = (filters.min_price ?? "").trim();
  const maxPriceFilter = (filters.max_price ?? "").trim();
  if (minPriceFilter) {
    const minCents = Number(minPriceFilter) * 100;
    if (!Number.isNaN(minCents) && (row.reserve_cents ?? 0) < minCents) return false;
  }
  if (maxPriceFilter) {
    const maxCents = Number(maxPriceFilter) * 100;
    if (!Number.isNaN(maxCents) && (row.reserve_cents ?? 0) > maxCents) return false;
  }

  const minBidPriceFilter = (filters.min_bid_price ?? "").trim();
  const maxBidPriceFilter = (filters.max_bid_price ?? "").trim();
  if (minBidPriceFilter) {
    const minCents = Number(minBidPriceFilter) * 100;
    if (!Number.isNaN(minCents) && (row.current_lowest_bid_cents ?? 0) < minCents) {
      return false;
    }
  }
  if (maxBidPriceFilter) {
    const maxCents = Number(maxBidPriceFilter) * 100;
    if (!Number.isNaN(maxCents) && (row.current_lowest_bid_cents ?? 0) > maxCents) {
      return false;
    }
  }

  const buyNowOnlyFilter = (filters.buy_now_only ?? "").trim();
  if (
    buyNowOnlyFilter &&
    buyNowOnlyFilter !== "0" &&
    buyNowOnlyFilter.toLowerCase() !== "false"
  ) {
    if (!(typeof row.buy_now_cents === "number" && row.buy_now_cents > 0)) return false;
  }

  const bedroomsFilter = (filters.bedrooms ?? "").trim();
  if (bedroomsFilter) {
    const beds = Number(bedroomsFilter);
    if (!Number.isNaN(beds) && beds > 0) {
      const br = row.bedrooms;
      if (beds >= 5) {
        if (typeof br !== "number" || br < 5) return false;
      } else if (br !== beds) {
        return false;
      }
    }
  }

  const bathroomsFilter = (filters.bathrooms ?? "").trim();
  if (bathroomsFilter) {
    const baths = Number(bathroomsFilter);
    if (!Number.isNaN(baths) && baths > 0) {
      const bt = row.bathrooms;
      if (baths >= 4) {
        if (typeof bt !== "number" || bt < 4) return false;
      } else if (bt !== baths) {
        return false;
      }
    }
  }

  const propertyTypeFilter = (filters.property_type ?? "").trim();
  if (propertyTypeFilter && propertyTypeFilter.toLowerCase() !== "any") {
    if (String(row.property_type ?? "") !== propertyTypeFilter) return false;
  }

  return true;
}

/**
 * Live listing still on the clock (matches list card visibility; uses same UTC rules as UI).
 */
export function isListingLiveForJobsBrowse(row: ListingFilterRow): boolean {
  if (String(row.status ?? "").toLowerCase() !== "live") return false;
  if (row.cancelled_early_at != null && String(row.cancelled_early_at).trim() !== "") {
    return false;
  }
  if (!row.end_time) return false;
  return parseUtcTimestamp(String(row.end_time)) > Date.now();
}
