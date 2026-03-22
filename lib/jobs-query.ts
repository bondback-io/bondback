/**
 * Shared query builder for jobs/listings list (SSR and load-more action).
 * Keeps filter/sort logic in one place for consistency.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type JobsListFilters = {
  suburb?: string;
  postcode?: string;
  sort?: string;
  min_price?: string;
  max_price?: string;
  bedrooms?: string;
  bathrooms?: string;
  property_type?: string;
};

export function buildLiveListingsQuery(
  supabase: SupabaseClient,
  filters: JobsListFilters,
  takenIds: (string | number)[]
) {
  const now = new Date().toISOString();
  const suburbFilter = (filters.suburb ?? "").trim();
  const postcodeFilter = (filters.postcode ?? "").trim();
  const sort = (filters.sort ?? "").trim();
  const minPriceFilter = (filters.min_price ?? "").trim();
  const maxPriceFilter = (filters.max_price ?? "").trim();
  const bedroomsFilter = (filters.bedrooms ?? "").trim();
  const bathroomsFilter = (filters.bathrooms ?? "").trim();
  const propertyTypeFilter = (filters.property_type ?? "").trim();

  let query = supabase
    .from("listings")
    .select("*")
    .eq("status", "live")
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
  if (propertyTypeFilter) {
    query = query.eq("property_type", propertyTypeFilter);
  }

  switch (sort) {
    case "price-asc":
      query = query.order("reserve_cents", { ascending: true, nullsFirst: true });
      break;
    case "price-desc":
      query = query.order("reserve_cents", { ascending: false, nullsLast: true });
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
