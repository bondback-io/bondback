import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";
import { formatCents, type ListingRow } from "@/lib/listings";

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * When several listings share the same (or almost the same) coordinates, pins stack and hide
 * each other. Group by exact coords first, then merge groups whose points are within
 * `proximityM` (suburb centres a few hundred metres apart can still overlap at typical zoom).
 */
function spreadOverlappingPins(points: FindJobsMapPoint[], proximityM = 220): void {
  const n = points.length;
  if (n <= 1) return;

  const parent: number[] = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    const pi = parent[i];
    if (pi === undefined || pi === i) return i;
    const root = find(pi);
    parent[i] = root;
    return root;
  };
  const union = (i: number, j: number) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[rj] = ri;
  };

  const byKey = new Map<string, number[]>();
  points.forEach((p, idx) => {
    const k = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(idx);
  });
  for (const indices of byKey.values()) {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        union(indices[a]!, indices[b]!);
      }
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pi = points[i]!;
      const pj = points[j]!;
      if (haversineMeters(pi.lat, pi.lon, pj.lat, pj.lon) <= proximityM) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }

  for (const indices of groups.values()) {
    if (indices.length <= 1) continue;
    let sumLat = 0;
    let sumLon = 0;
    for (const idx of indices) {
      const p = points[idx]!;
      sumLat += p.lat;
      sumLon += p.lon;
    }
    const cLat = sumLat / indices.length;
    const cLon = sumLon / indices.length;
    const latRad = (cLat * Math.PI) / 180;
    indices.forEach((idx, ord) => {
      const p = points[idx]!;
      const angle = (2 * Math.PI * ord) / indices.length;
      const meters = 28 + ord * 16;
      const dLat = (meters / 111_320) * Math.sin(angle);
      const dLon = (meters / (111_320 * Math.cos(latRad))) * Math.cos(angle);
      p.lat = cLat + dLat;
      p.lon = cLon + dLon;
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
  spreadOverlappingPins(out, 220);
  return out;
}
