import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseLocationSlug } from "@/lib/seo/location-slug";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Database } from "@/types/supabase";
import { QLD_REGION_STATIC_SUBURBS } from "@/lib/seo/qld-regional-static-seo";
import type { SuburbSeoRow } from "@/lib/seo/suburb-seo-types";

export type { SuburbSeoRow } from "@/lib/seo/suburb-seo-types";

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

  const fallback = QLD_REGION_STATIC_SUBURBS[norm] ?? null;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    const supabase = await createServerSupabaseClient();
    const fromDb = await querySuburbRow(supabase, parsed);
    if (fromDb) return fromDb;
    return fallback;
  }

  return unstable_cache(
    async () => {
      const a = createSupabaseAdminClient();
      if (!a) return fallback;
      const fromDb = await querySuburbRow(a, parsed);
      if (fromDb) return fromDb;
      return fallback;
    },
    ["suburb-seo-by-slug", norm],
    { revalidate: 3600, tags: [CACHE_TAGS.suburbs] }
  )();
}
