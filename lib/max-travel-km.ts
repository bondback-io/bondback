/**
 * Cleaner max travel (km) — single cap for signup, profile, job/cleaner search radius, and server clamps.
 */
export const MIN_TRAVEL_KM = 5;
export const MAX_TRAVEL_KM = 150;

export function clampMaxTravelKm(n: number): number {
  const r = Math.round(n);
  return Math.max(MIN_TRAVEL_KM, Math.min(MAX_TRAVEL_KM, r));
}

/** Next preset for empty-state "Increase radius" links (jobs / browse cleaners). */
export function nextSearchRadiusKm(current: number): number {
  const c = Math.round(current);
  if (c < 20) return 20;
  if (c < 50) return 50;
  if (c < 100) return 100;
  if (c < MAX_TRAVEL_KM) return MAX_TRAVEL_KM;
  return MAX_TRAVEL_KM;
}
