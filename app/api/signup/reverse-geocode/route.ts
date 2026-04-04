import { NextResponse } from "next/server";

const AU_STATE_CODES = new Set(["QLD", "NSW", "VIC", "WA", "SA", "TAS", "NT", "ACT"]);

/** Map Nominatim address fields to Bond Back `profiles.state` (AU state/territory code). */
function mapNominatimStateToCode(addr: Record<string, string>): string | undefined {
  const iso = addr["ISO3166-2-lvl4"];
  if (typeof iso === "string" && iso.toUpperCase().startsWith("AU-")) {
    const code = iso.slice(3).toUpperCase();
    if (AU_STATE_CODES.has(code)) return code;
  }
  const st = typeof addr.state === "string" ? addr.state.trim().toLowerCase() : "";
  const map: Record<string, string> = {
    queensland: "QLD",
    "new south wales": "NSW",
    victoria: "VIC",
    "western australia": "WA",
    "south australia": "SA",
    tasmania: "TAS",
    "northern territory": "NT",
    "australian capital territory": "ACT",
  };
  return map[st];
}

/**
 * Server-side Nominatim reverse lookup for AU signup suburb/postcode prefill.
 * Browsers cannot call nominatim.openstreetmap.org reliably (CORS); this route proxies it.
 */
export async function POST(req: Request) {
  let body: { lat?: unknown; lon?: unknown };
  try {
    body = (await req.json()) as { lat?: unknown; lon?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const lat = typeof body.lat === "number" ? body.lat : null;
  const lon = typeof body.lon === "number" ? body.lon : null;

  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  // Rough Australia bounding box (reject obvious abuse / mistakes)
  if (lat < -44 || lat > -9 || lon < 112 || lon > 154) {
    return NextResponse.json({ error: "coordinates outside Australia" }, { status: 400 });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&countrycodes=au`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-AU",
        "User-Agent": "BondBack/1.0 (signup reverse-geocode; https://www.bondback.io)",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      console.warn("[api/signup/reverse-geocode] nominatim_http", { status: res.status });
      return NextResponse.json({ postcode: undefined, suburb: undefined });
    }
    const data = (await res.json()) as { address?: Record<string, string> };
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
    const state = mapNominatimStateToCode(addr as Record<string, string>) ?? "";
    return NextResponse.json({
      ...(postcode ? { postcode } : {}),
      ...(suburb ? { suburb } : {}),
      ...(state ? { state } : {}),
    });
  } catch (e) {
    console.error("[api/signup/reverse-geocode]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "reverse_geocode_failed" }, { status: 502 });
  }
}
