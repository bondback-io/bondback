/**
 * Client-only helpers for signup suburb/postcode prefill.
 * Cache last successful values in localStorage; reverse-geocode via same-origin API (Nominatim server-side).
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

async function reverseGeocodeViaApi(lat: number, lon: number): Promise<SignupLocationCache | null> {
  try {
    const res = await fetch("/api/signup/reverse-geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { postcode?: string; suburb?: string };
    const postcode = typeof data.postcode === "string" ? data.postcode.trim() : "";
    const suburb = typeof data.suburb === "string" ? data.suburb.trim() : "";
    if (!postcode && !suburb) return null;
    return {
      ...(postcode ? { postcode } : {}),
      ...(suburb ? { suburb } : {}),
    };
  } catch {
    return null;
  }
}

function getCurrentPosition(): Promise<GeolocationPosition | null> {
  if (typeof window === "undefined" || !navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      {
        enableHighAccuracy: false,
        /** Prefer a cached fix so permission + coords often resolve immediately when already granted. */
        maximumAge: 600_000,
        timeout: 30_000,
      }
    );
  });
}

/**
 * Browser geolocation + server reverse lookup (Australia). Fails silently if denied or offline.
 */
export async function reverseGeocodeAuForSignupPrefill(): Promise<SignupLocationCache | null> {
  if (typeof window === "undefined") return null;

  const position = await getCurrentPosition();
  if (!position) return null;

  const { latitude, longitude } = position.coords;
  return reverseGeocodeViaApi(latitude, longitude);
}
