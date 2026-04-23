import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";
import { formatCents, type ListingRow } from "@/lib/listings";
import { normalizeServiceType } from "@/lib/service-types";

/** Cap pins for first paint; cluster + pan still feels full — rest appear on zoom/interaction if extended later. */
export const FIND_JOBS_MAP_POINTS_SOFT_CAP = 200;

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
    const rowExt = l as ListingRow & {
      service_type?: string | null;
      recurring_frequency?: string | null;
      is_urgent?: boolean | null;
    };
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
      serviceType: normalizeServiceType(rowExt.service_type),
      recurringFrequency:
        typeof rowExt.recurring_frequency === "string" ? rowExt.recurring_frequency : null,
      isUrgent: rowExt.is_urgent === true,
    });
  }
  return out;
}
