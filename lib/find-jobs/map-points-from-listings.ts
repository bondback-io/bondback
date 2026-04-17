import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";
import { formatCents, type ListingRow } from "@/lib/listings";

/**
 * When several listings share the same suburb centre, pins stack on one dot. Nudge duplicates
 * outward slightly so every job is visible on the map.
 */
function spreadOverlappingPins(points: FindJobsMapPoint[]): void {
  const byKey = new Map<string, number[]>();
  points.forEach((p, idx) => {
    const k = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(idx);
  });
  for (const indices of byKey.values()) {
    if (indices.length <= 1) continue;
    indices.forEach((idx, ord) => {
      if (ord === 0) return;
      const p = points[idx];
      if (!p) return;
      const angle = (ord * 72) * (Math.PI / 180);
      const meters = 42 * ord;
      const latRad = (p.lat * Math.PI) / 180;
      const dLat = (meters / 111320) * Math.sin(angle);
      const dLon = (meters / (111320 * Math.cos(latRad))) * Math.cos(angle);
      p.lat += dLat;
      p.lon += dLon;
    });
  }
}

/** Build map markers from listing rows that include `lat` / `lon` (suburb-centre coords). */
export function listingsToFindJobsMapPoints(
  listings: ListingRow[],
  bidCountByListingId?: Record<string, number>
): FindJobsMapPoint[] {
  const out: FindJobsMapPoint[] = [];
  for (const l of listings) {
    const row = l as ListingRow & { lat?: number; lon?: number };
    if (typeof row.lat !== "number" || typeof row.lon !== "number") continue;
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) continue;
    const id = String(l.id);
    const bids = bidCountByListingId?.[id] ?? 0;
    const currentCents = l.current_lowest_bid_cents ?? 0;
    const buyNow = l.buy_now_cents;
    const loc = [l.suburb, l.postcode].filter(Boolean).join(" ") || "—";
    out.push({
      id,
      title: (l.title ?? "Bond clean").slice(0, 200),
      priceLabel: formatCents(currentCents),
      lat: row.lat,
      lon: row.lon,
      locationLabel: loc,
      currentBidLabel: formatCents(currentCents),
      buyNowLabel:
        typeof buyNow === "number" && buyNow > 0 ? formatCents(buyNow) : null,
      bidCount: typeof bids === "number" && bids >= 0 ? bids : 0,
    });
  }
  spreadOverlappingPins(out);
  return out;
}
