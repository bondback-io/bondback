/**
 * Client-only helpers for signup suburb/postcode prefill.
 * Cache last successful values in localStorage; optionally reverse-geocode via OSM Nominatim (AU).
 */

export const SIGNUP_LOCATION_STORAGE_KEY = "bondback_signup_location";

export type SignupLocationCache = {
  postcode?: string;
  suburb?: string;
};

export function loadCachedSignupLocation(): SignupLocationCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SIGNUP_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SignupLocationCache;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      postcode: typeof parsed.postcode === "string" ? parsed.postcode.trim() : undefined,
      suburb: typeof parsed.suburb === "string" ? parsed.suburb.trim() : undefined,
    };
  } catch {
    return null;
  }
}

export function saveCachedSignupLocation(postcode: string, suburb: string): void {
  if (typeof window === "undefined") return;
  try {
    const payload: SignupLocationCache = {};
    const pc = postcode.trim();
    const sub = suburb.trim();
    if (pc) payload.postcode = pc;
    if (sub) payload.suburb = sub;
    if (!payload.postcode && !payload.suburb) {
      window.localStorage.removeItem(SIGNUP_LOCATION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SIGNUP_LOCATION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

/**
 * Uses browser geolocation + Nominatim reverse search (Australia). Fails silently if denied or offline.
 * Respect Nominatim usage policy: low volume, identifiable User-Agent.
 */
export async function reverseGeocodeAuForSignupPrefill(): Promise<SignupLocationCache | null> {
  if (typeof window === "undefined" || !navigator.geolocation) return null;

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 }
    );
  });
  if (!position) return null;

  const { latitude, longitude } = position.coords;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&countrycodes=au`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-AU",
        "User-Agent": "BondBack/1.0 (signup location prefill; contact: https://bondback.com.au)",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: Record<string, string>;
    };
    const addr = data?.address ?? {};
    const postcode = typeof addr.postcode === "string" ? addr.postcode.trim() : "";
    const suburbRaw =
      addr.suburb ||
      addr.city ||
      addr.town ||
      addr.city_district ||
      addr.neighbourhood ||
      "";
    const suburb = typeof suburbRaw === "string" ? suburbRaw.trim() : "";
    if (!postcode && !suburb) return null;
    return {
      ...(postcode ? { postcode } : {}),
      ...(suburb ? { suburb } : {}),
    };
  } catch {
    return null;
  }
}
