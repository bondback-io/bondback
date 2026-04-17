import type { SupabaseClient } from "@supabase/supabase-js";
import { getSuburbLatLonForPostcodeAndSuburb } from "@/lib/geo/suburb-lat-lon";

export type LatLon = { lat: number; lon: number };

/**
 * Batch-resolve listing coordinates from suburb/postcode via the `suburbs` table (same source as
 * distance filtering elsewhere). Deduplicates locality keys to limit DB round-trips.
 */
export async function resolveListingCoordinatesById(
  /** Typed or anon client — suburbs lookup matches `getSuburbLatLonForPostcodeAndSuburb`. */
  supabase: SupabaseClient<any>,
  listings: Array<{ id: string; suburb: string; postcode: string | number }>
): Promise<Record<string, LatLon | null>> {
  const out: Record<string, LatLon | null> = {};
  if (listings.length === 0) return out;

  const keyFor = (postcode: string | number, suburb: string) =>
    `${String(postcode).replace(/\D/g, "").slice(0, 4)}::${suburb.trim().toLowerCase()}`;

  const uniqueKeys = new Map<string, { postcode: string; suburb: string }>();
  for (const l of listings) {
    const pc = String(l.postcode ?? "").trim();
    const sub = String(l.suburb ?? "").trim();
    if (!pc || !sub) continue;
    const k = keyFor(pc, sub);
    if (!uniqueKeys.has(k)) uniqueKeys.set(k, { postcode: pc, suburb: sub });
  }

  const resolved = new Map<string, LatLon | null>();
  await Promise.all(
    [...uniqueKeys.entries()].map(async ([k, v]) => {
      const ll = await getSuburbLatLonForPostcodeAndSuburb(supabase, v.postcode, v.suburb);
      resolved.set(k, ll);
    })
  );

  for (const l of listings) {
    const pc = String(l.postcode ?? "").trim();
    const sub = String(l.suburb ?? "").trim();
    if (!pc || !sub) {
      out[l.id] = null;
      continue;
    }
    out[l.id] = resolved.get(keyFor(pc, sub)) ?? null;
  }

  return out;
}
