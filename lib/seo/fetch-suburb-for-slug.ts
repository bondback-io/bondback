import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseLocationSlug } from "@/lib/seo/location-slug";

export type SuburbSeoRow = {
  suburb: string;
  postcode: string;
  state: string;
  lat: number | null;
  lon: number | null;
};

/**
 * Resolve a location slug against `public.suburbs` (case-insensitive suburb match).
 */
export async function fetchSuburbForSlug(
  slug: string
): Promise<SuburbSeoRow | null> {
  const parsed = parseLocationSlug(slug);
  if (!parsed) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("suburbs")
    .select("suburb, postcode, state, lat, lon")
    .eq("postcode", parsed.postcode)
    .eq("state", parsed.state)
    .ilike("suburb", parsed.suburb)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as SuburbSeoRow;
}
