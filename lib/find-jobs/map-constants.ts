/** Default map center (Sunshine Coast, QLD) when no search center is set. */
export const DEFAULT_FIND_JOBS_CENTER = {
  lat: -26.652,
  lon: 153.081,
} as const;

/**
 * Default radius (km) for find-jobs map + list when `radius_km` is absent from the URL.
 * 50 km was too tight: e.g. Gympie QLD (~66 km from the default Sunshine Coast center) was hidden.
 */
export const DEFAULT_FIND_JOBS_RADIUS_KM = 100;
