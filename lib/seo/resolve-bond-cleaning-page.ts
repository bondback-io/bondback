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
import type { SeoBlogPost, SeoFaqPayload, SeoLandingPayload } from "@/lib/seo/seo-content-types";
import type { SeoContentRow } from "@/lib/seo/fetch-seo-content";

export type BondCleaningResolveResult =
  | { status: "ok"; row: SuburbSeoRow; seo: SeoContentRow | null }
  | { status: "not_found" }
  | { status: "not_published" };

function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "object") return v as T;
  return fallback;
}

async function loadSeoBundle(
  client: SupabaseClient<Database, "public", any>,
  pageSlugNorm: string
): Promise<SeoContentRow | null> {
  const { data, error } = await client
    .from("seo_content")
    .select("id, suburb_id, region_id, page_slug, landing, blog_posts, faq_schema, meta_title, meta_description")
    .eq("page_slug", pageSlugNorm)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Database["public"]["Tables"]["seo_content"]["Row"];
  return {
    id: row.id,
    suburb_id: row.suburb_id,
    region_id: row.region_id,
    page_slug: row.page_slug,
    landing: parseJson(row.landing, {} as SeoLandingPayload),
    blog_posts: parseJson(row.blog_posts, [] as SeoBlogPost[]),
    faq_schema: parseJson(row.faq_schema, { questions: [] } as SeoFaqPayload),
    meta_title: row.meta_title,
    meta_description: row.meta_description,
  };
}

async function querySuburbRow(
  client: SupabaseClient<Database, "public", any>,
  parsed: NonNullable<ReturnType<typeof parseLocationSlug>>
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
 * Resolves `/bond-cleaning/[slug]` for public pages.
 *
 * - If `seo_content` exists for the slug but `seo_suburbs.completed` is false → **not_published** (404).
 * - If `seo_content` exists and completed → full **seo** payload.
 * - Otherwise legacy: `public.suburbs` or static QLD fallbacks (no SEO pipeline).
 */
export async function resolveBondCleaningPage(slug: string): Promise<BondCleaningResolveResult> {
  const norm = slug.trim().toLowerCase();
  const parsed = parseLocationSlug(norm);
  if (!parsed) return { status: "not_found" };

  const admin = createSupabaseAdminClient();
  const client: SupabaseClient<Database, "public", any> = admin ?? (await createServerSupabaseClient());

  const { data: scRow } = await client
    .from("seo_content")
    .select("suburb_id")
    .eq("page_slug", norm)
    .maybeSingle();

  if (scRow) {
    const { data: subMeta } = await client
      .from("seo_suburbs")
      .select("completed, suburb_name, postcode")
      .eq("id", (scRow as { suburb_id: string }).suburb_id)
      .maybeSingle();

    if (!subMeta) {
      return { status: "not_found" };
    }

    const completed = (subMeta as { completed?: boolean }).completed;
    if (!completed) {
      return { status: "not_published" };
    }

    const seo = await loadSeoBundle(client, norm);
    if (!seo) {
      return { status: "not_found" };
    }

    const sm = subMeta as { suburb_name: string; postcode: string };
    const row: SuburbSeoRow = {
      suburb: sm.suburb_name,
      postcode: sm.postcode,
      state: parsed.state,
      lat: null,
      lon: null,
    };

    return { status: "ok", row, seo };
  }

  const fromDb = await querySuburbRow(client, parsed);
  if (fromDb) {
    return { status: "ok", row: fromDb, seo: null };
  }

  const fallback = QLD_REGION_STATIC_SUBURBS[norm] ?? null;
  if (fallback) {
    return { status: "ok", row: fallback, seo: null };
  }

  return { status: "not_found" };
}

/** Cached resolver for metadata / ISR (no cookies in cached branch). */
export async function resolveBondCleaningPageCached(slug: string): Promise<BondCleaningResolveResult> {
  const norm = slug.trim().toLowerCase();
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return resolveBondCleaningPage(slug);
  }

  return unstable_cache(
    async () => resolveBondCleaningPage(slug),
    ["bond-cleaning-page", norm],
    { revalidate: 3600, tags: [CACHE_TAGS.suburbs] }
  )();
}
