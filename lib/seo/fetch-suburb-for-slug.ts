import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseLocationSlug } from "@/lib/seo/location-slug";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Database } from "@/types/supabase";

export type SuburbSeoRow = {
  suburb: string;
  postcode: string;
  state: string;
  lat: number | null;
  lon: number | null;
};

type ParsedSlug = NonNullable<ReturnType<typeof parseLocationSlug>>;

async function querySuburbRow(
  client: SupabaseClient<Database, "public", any>,
  parsed: ParsedSlug
): Promise<SuburbSeoRow | null> {
  const { data, error } = await client
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

/**
 * Resolve a location slug against `public.suburbs` (case-insensitive suburb match).
 * Cached path uses service role only — `unstable_cache` must not call `cookies()`.
 */
export async function fetchSuburbForSlug(
  slug: string
): Promise<SuburbSeoRow | null> {
  const norm = slug.trim().toLowerCase();
  const parsed = parseLocationSlug(norm);
  if (!parsed) return null;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    const supabase = await createServerSupabaseClient();
    return querySuburbRow(supabase, parsed);
  }

  return unstable_cache(
    async () => {
      const a = createSupabaseAdminClient();
      if (!a) return null;
      return querySuburbRow(a, parsed);
    },
    ["suburb-seo-by-slug", norm],
    { revalidate: 3600, tags: [CACHE_TAGS.suburbs] }
  )();
}
