import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";
import { formatCents, type ListingRow } from "@/lib/listings";

/** Build map markers from listing rows that include `lat` / `lon` (suburb-centre coords). */
export function listingsToFindJobsMapPoints(listings: ListingRow[]): FindJobsMapPoint[] {
  const out: FindJobsMapPoint[] = [];
  for (const l of listings) {
    const row = l as ListingRow & { lat?: number; lon?: number };
    if (typeof row.lat !== "number" || typeof row.lon !== "number") continue;
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) continue;
    out.push({
      id: String(l.id),
      title: (l.title ?? "Bond clean").slice(0, 200),
      priceLabel: formatCents(l.current_lowest_bid_cents ?? 0),
      lat: row.lat,
      lon: row.lon,
    });
  }
  return out;
}
