import "server-only";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseLocationSlug } from "@/lib/seo/location-slug";
import { CACHE_TAGS } from "@/lib/cache-tags";

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
  const norm = slug.trim().toLowerCase();
  const parsed = parseLocationSlug(norm);
  if (!parsed) return null;
  return unstable_cache(
    async () => {
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
    },
    ["suburb-seo-by-slug", norm],
    { revalidate: 3600, tags: [CACHE_TAGS.suburbs] }
  )();
}
