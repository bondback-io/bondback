/** Client-only jobs search radius (km). Synced with Jobs list slider on mobile. */
const STORAGE_KEY = "bondback_jobs_radius_km";

const MIN = 5;
const MAX = 100;
const STEP = 5;

export function clampRadiusKm(n: number): number {
  const rounded = Math.round(n / STEP) * STEP;
  return Math.min(MAX, Math.max(MIN, rounded));
}

export function getStoredRadiusKm(fallback: number): number {
  if (typeof window === "undefined") return clampRadiusKm(fallback);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return clampRadiusKm(fallback);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= MIN && n <= MAX) return clampRadiusKm(n);
  } catch {
    /* ignore */
  }
  return clampRadiusKm(fallback);
}

export function setStoredRadiusKm(km: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(clampRadiusKm(km)));
  } catch {
    /* ignore */
  }
}
