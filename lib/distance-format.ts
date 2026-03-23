export type DistanceUnit = "km" | "mi";

const KM_TO_MI = 0.621371;

export function kmToMiles(km: number): number {
  return km * KM_TO_MI;
}

/** Card / listing distance from a km value (internal storage is always km). */
export function formatDistanceKmLabel(km: number, unit: DistanceUnit): string {
  if (!Number.isFinite(km)) return "";
  if (unit === "mi") {
    return `~${Math.round(kmToMiles(km))} mi`;
  }
  return `~${Math.round(km)} km`;
}

/** Radius preset chip label (search still uses km in URL). */
export function formatRadiusPresetLabel(km: number, unit: DistanceUnit): string {
  if (!Number.isFinite(km)) return "";
  if (unit === "mi") {
    return `${Math.round(kmToMiles(km))} mi`;
  }
  return `${km} km`;
}

/** Slider / banner copy: "Jobs within X km" / "Jobs within X mi". */
export function formatRadiusBannerLabel(radiusKm: number, unit: DistanceUnit): string {
  if (!Number.isFinite(radiusKm)) return "";
  if (unit === "mi") {
    return `${Math.round(kmToMiles(radiusKm))} mi`;
  }
  return `${radiusKm} km`;
}
