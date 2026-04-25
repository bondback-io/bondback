import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";
import { formatCents, type ListingRow } from "@/lib/listings";
import { normalizeServiceType } from "@/lib/service-types";

/** Cap pins for first paint; rest may be trimmed if extended later. */
export const FIND_JOBS_MAP_POINTS_SOFT_CAP = 200;

const PIN_SPREAD_M = 85;
const EARTH_M_PER_DEG_LAT = 111_320;

/**
 * Nudge marks that share the same suburb centre (identical lat/lon) in a small ring so
 * list cards remain accurate while the map shows separate pins.
 */
function spreadDuplicateMapPinLocations(points: FindJobsMapPoint[]): FindJobsMapPoint[] {
  if (points.length < 2) return points;
  const groups = new Map<string, FindJobsMapPoint[]>();
  for (const p of points) {
    const key = `${p.lat.toFixed(5)}|${p.lon.toFixed(5)}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }
  const out: FindJobsMapPoint[] = [];
  for (const g of groups.values()) {
    if (g.length === 1) {
      out.push(g[0]!);
      continue;
    }
    const n = g.length;
    for (let i = 0; i < n; i++) {
      const p = g[i]!;
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const mLat = (PIN_SPREAD_M / EARTH_M_PER_DEG_LAT) * Math.cos(angle);
      const cosLat = Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
      const mLon = (PIN_SPREAD_M / (EARTH_M_PER_DEG_LAT * cosLat)) * Math.sin(angle);
      out.push({ ...p, lat: p.lat + mLat, lon: p.lon + mLon });
    }
  }
  return out;
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
    const suburb = String(l.suburb ?? "").trim();
    const postcode = String(l.postcode ?? "").trim();
    const rowState = l as ListingRow & { state?: string | null };
    const stateRaw = rowState.state != null ? String(rowState.state).trim() : "";
    const state = stateRaw !== "" ? stateRaw : null;
    const loc = [suburb, postcode].filter(Boolean).join(" ") || "—";
    const rowExt = l as ListingRow & {
      service_type?: string | null;
      recurring_frequency?: string | null;
      is_urgent?: boolean | null;
    };
    const fullTitle = (l.title ?? "Bond clean").slice(0, 200);
    const titleShort =
      fullTitle.length > 96 ? `${fullTitle.slice(0, 93)}…` : fullTitle;
    const typeLabel = String(l.property_type ?? "property").replace(/_/g, " ");
    const beds = Math.max(0, Math.floor(Number(l.bedrooms ?? 0)));
    const baths = Math.max(0, Math.floor(Number(l.bathrooms ?? 0)));
    const propertySummary = `${beds} bed${beds === 1 ? "" : "s"} · ${baths} bath${baths === 1 ? "" : "s"} · ${typeLabel}`;
    out.push({
      id,
      title: fullTitle,
      titleShort,
      priceLabel: formatCents(currentCents),
      lat: row.lat,
      lon: row.lon,
      locationLabel: loc,
      suburb,
      postcode,
      state,
      propertySummary,
      currentBidLabel: formatCents(currentCents),
      buyNowLabel:
        typeof buyNow === "number" && buyNow > 0 ? formatCents(buyNow) : null,
      bidCount: typeof bids === "number" && bids >= 0 ? bids : 0,
      serviceType: normalizeServiceType(rowExt.service_type),
      recurringFrequency:
        typeof rowExt.recurring_frequency === "string" ? rowExt.recurring_frequency : null,
      isUrgent: rowExt.is_urgent === true,
    });
  }
  return spreadDuplicateMapPinLocations(out);
}
