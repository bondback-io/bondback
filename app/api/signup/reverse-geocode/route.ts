import { NextResponse } from "next/server";

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
        "User-Agent": "BondBack/1.0 (signup reverse-geocode; https://bondback.com.au)",
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
    return NextResponse.json({
      ...(postcode ? { postcode } : {}),
      ...(suburb ? { suburb } : {}),
    });
  } catch (e) {
    console.error("[api/signup/reverse-geocode]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "reverse_geocode_failed" }, { status: 502 });
  }
}
