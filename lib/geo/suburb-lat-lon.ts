import type { SupabaseClient } from "@supabase/supabase-js";

/** Strip characters that break Postgres ILIKE patterns when interpolated. */
function sanitizeIlikeFragment(s: string): string {
  return s.trim().replace(/\s+/g, " ").replace(/[%_\\]/g, " ");
}

type LatLon = { lat: number; lon: number };

function rowLatLon(row: {
  lat?: number | null;
  lon?: number | null;
}): LatLon | null {
  if (row.lat == null || row.lon == null) return null;
  if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) return null;
  return { lat: row.lat, lon: row.lon };
}

/**
 * Look up lat/lon for a postcode from the suburbs table (first row for that postcode).
 * Returns null if not found or table has no lat/lon.
 *
 * Uses `SupabaseClient<any>` so callers with typed `Database` (where `suburbs` may be absent)
 * don't trigger excessive type instantiation.
 */
export async function getSuburbLatLon(
  admin: SupabaseClient<any>,
  postcode: string,
  _suburb?: string | null
): Promise<LatLon | null> {
  const pc = (postcode ?? "").trim();
  const pcDigits = pc.replace(/\D/g, "");
  const search = pcDigits.length >= 4 ? pcDigits.slice(0, 4) : pc;
  if (!search) return null;
  const { data: rows } = await admin
    .from("suburbs")
    .select("lat, lon")
    .eq("postcode", search)
    .limit(1);
  const row = Array.isArray(rows) && rows[0] ? (rows[0] as { lat?: number | null; lon?: number | null }) : null;
  if (!row || row.lat == null || row.lon == null) return null;
  return rowLatLon(row);
}

/**
 * Match a specific locality within a postcode (avoids centroid of the first random row).
 */
export async function getSuburbLatLonForPostcodeAndSuburb(
  admin: SupabaseClient<any>,
  postcode: string,
  suburbRaw: string
): Promise<LatLon | null> {
  const pc = postcode.replace(/\D/g, "").slice(0, 4);
  const sub = sanitizeIlikeFragment(suburbRaw);
  if (pc.length < 4 || sub.length < 2) return null;

  const { data: rows } = await admin
    .from("suburbs")
    .select("suburb, lat, lon")
    .eq("postcode", pc)
    .ilike("suburb", `%${sub}%`)
    .limit(25);

  if (!Array.isArray(rows) || rows.length === 0) return null;

  const want = sub.toLowerCase();
  for (const r of rows) {
    const name = String((r as { suburb?: string }).suburb ?? "").trim().toLowerCase();
    if (name === want) {
      const ll = rowLatLon(r as { lat?: number | null; lon?: number | null });
      if (ll) return ll;
    }
  }
  const first = rows[0] as { lat?: number | null; lon?: number | null };
  return rowLatLon(first);
}

/**
 * Resolve by suburb name when postcode-only lookup is insufficient.
 * Optional `postcodeHint` narrows to one state/area when multiple localities share a name.
 */
export async function getSuburbLatLonFromSuburbName(
  admin: SupabaseClient<any>,
  suburbRaw: string,
  postcodeHint?: string | null
): Promise<LatLon | null> {
  const sub = sanitizeIlikeFragment(suburbRaw);
  if (sub.length < 2) return null;

  const hint = (postcodeHint ?? "").replace(/\D/g, "").slice(0, 4);
  let query = admin
    .from("suburbs")
    .select("suburb, lat, lon, postcode")
    .ilike("suburb", `%${sub}%`)
    .limit(25);

  if (hint.length >= 4) {
    query = query.eq("postcode", hint);
  }

  const { data: rows } = await query;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const want = sub.toLowerCase();
  for (const r of rows) {
    const name = String((r as { suburb?: string }).suburb ?? "").trim().toLowerCase();
    if (name === want) {
      const ll = rowLatLon(r as { lat?: number | null; lon?: number | null });
      if (ll) return ll;
    }
  }
  const first = rows[0] as { lat?: number | null; lon?: number | null };
  return rowLatLon(first);
}

/**
 * Lat/lon for the browse-cleaners map center when the client did not pass `center_lat` / `center_lon`
 * (e.g. user typed a suburb without picking a row from autocomplete).
 */
export async function resolveBrowseCleanersSearchCenter(
  admin: SupabaseClient<any>,
  params: {
    centerLat: number | null;
    centerLon: number | null;
    suburbFilter: string;
    postcodeFilter: string;
    profilePostcode: string | null;
  }
): Promise<LatLon | null> {
  const { centerLat, centerLon, suburbFilter, postcodeFilter, profilePostcode } = params;

  if (
    centerLat != null &&
    centerLon != null &&
    Number.isFinite(centerLat) &&
    Number.isFinite(centerLon)
  ) {
    return { lat: centerLat, lon: centerLon };
  }

  const sub = suburbFilter.trim().replace(/\s+/g, " ");
  const urlPc = postcodeFilter.replace(/\D/g, "").slice(0, 4);
  const profPc = (profilePostcode ?? "").replace(/\D/g, "").slice(0, 4);
  const pcForCombine =
    urlPc.length >= 4 ? urlPc : profPc.length >= 4 ? profPc : "";

  if (sub.length >= 2 && pcForCombine.length >= 4) {
    const ll = await getSuburbLatLonForPostcodeAndSuburb(admin, pcForCombine, sub);
    if (ll) return ll;
  }

  if (urlPc.length >= 4) {
    const ll = await getSuburbLatLon(admin, urlPc);
    if (ll) return ll;
  }

  if (profPc.length >= 4 && urlPc.length < 4) {
    const ll = await getSuburbLatLon(admin, profPc);
    if (ll) return ll;
  }

  if (sub.length >= 2) {
    const hint = urlPc.length >= 4 ? urlPc : profPc.length >= 4 ? profPc : null;
    return getSuburbLatLonFromSuburbName(admin, sub, hint);
  }

  return null;
}

/**
 * Best-effort lat/lon for a cleaner profile for distance sorting (postcode centroid,
 * then locality within postcode, then suburb name).
 */
export async function getLatLonForCleanerProfile(
  admin: SupabaseClient<any>,
  suburb: string | null,
  postcode: string | null
): Promise<LatLon | null> {
  const pc = (postcode ?? "").replace(/\D/g, "").slice(0, 4);
  const sub = (suburb ?? "").trim();

  if (pc.length >= 4 && sub.length >= 2) {
    const ll = await getSuburbLatLonForPostcodeAndSuburb(admin, pc, sub);
    if (ll) return ll;
  }

  if (pc.length >= 4) {
    const ll = await getSuburbLatLon(admin, pc);
    if (ll) return ll;
  }

  if (sub.length >= 2) {
    return getSuburbLatLonFromSuburbName(admin, sub, pc.length >= 4 ? pc : null);
  }

  return null;
}
