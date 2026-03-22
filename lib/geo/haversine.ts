/**
 * Haversine distance between two points on Earth (approximate sphere).
 * Returns distance in kilometres.
 */
const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Postcode-based distance approximation (no lat/lon).
 * Same postcode = 0 km (within radius). Different postcode = use a rough km so we can filter.
 * Optional: adjacent postcodes (e.g. 2000 vs 2001) could be ~5–10 km. Here we use same = 0, else 15 km so only same postcode matches unless max_travel_km is very high.
 */
export const POSTCODE_SAME_KM = 0;
export const POSTCODE_DIFFERENT_KM = 15;

export function postcodeDistanceKm(postcode1: string, postcode2: string): number {
  const p1 = (postcode1 ?? "").trim().replace(/\D/g, "");
  const p2 = (postcode2 ?? "").trim().replace(/\D/g, "");
  if (!p1 || !p2) return POSTCODE_DIFFERENT_KM;
  if (p1 === p2) return POSTCODE_SAME_KM;
  const n1 = parseInt(p1, 10);
  const n2 = parseInt(p2, 10);
  if (Number.isNaN(n1) || Number.isNaN(n2)) return POSTCODE_DIFFERENT_KM;
  const diff = Math.abs(n1 - n2);
  if (diff <= 1) return 10;
  if (diff <= 10) return 15;
  return 25;
}
