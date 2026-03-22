/**
 * Look up lat/lon for a postcode from the suburbs table (first row for that postcode).
 * Returns null if not found or table has no lat/lon.
 */
export async function getSuburbLatLon(
  admin: { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { limit: (n: number) => Promise<{ data: unknown[] | null }> } } } },
  postcode: string,
  _suburb?: string | null
): Promise<{ lat: number; lon: number } | null> {
  const pc = (postcode ?? "").trim();
  const pcDigits = pc.replace(/\D/g, "");
  const search = pcDigits.length >= 4 ? pcDigits.slice(0, 4) : pc;
  if (!search) return null;
  const { data: rows } = await (admin as any)
    .from("suburbs")
    .select("lat, lon")
    .eq("postcode", search)
    .limit(1);
  const row = Array.isArray(rows) && rows[0] ? (rows[0] as { lat?: number | null; lon?: number | null }) : null;
  if (!row || row.lat == null || row.lon == null) return null;
  return { lat: row.lat, lon: row.lon };
}
