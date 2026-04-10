import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import type { SeoBlogPost, SeoFaqPayload, SeoLandingPayload } from "@/lib/seo/seo-content-types";

export type SeoContentRow = {
  id: string;
  suburb_id: string;
  region_id: string;
  page_slug: string;
  landing: SeoLandingPayload;
  blog_posts: SeoBlogPost[];
  faq_schema: SeoFaqPayload;
  meta_title: string | null;
  meta_description: string | null;
};

function parseJsonField<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "object") return v as T;
  return fallback;
}

export async function fetchSeoContentByPageSlug(
  pageSlug: string
): Promise<SeoContentRow | null> {
  const norm = pageSlug.trim().toLowerCase();
  const admin = createSupabaseAdminClient();
  const client: SupabaseClient<Database, "public", any> = admin ?? (await createServerSupabaseClient());

  const { data, error } = await client
    .from("seo_content")
    .select("id, suburb_id, region_id, page_slug, landing, blog_posts, faq_schema, meta_title, meta_description")
    .eq("page_slug", norm)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Database["public"]["Tables"]["seo_content"]["Row"];
  return {
    id: row.id,
    suburb_id: row.suburb_id,
    region_id: row.region_id,
    page_slug: row.page_slug,
    landing: parseJsonField(row.landing, {} as SeoLandingPayload),
    blog_posts: parseJsonField(row.blog_posts, [] as SeoBlogPost[]),
    faq_schema: parseJsonField(row.faq_schema, { questions: [] } as SeoFaqPayload),
    meta_title: row.meta_title,
    meta_description: row.meta_description,
  };
}
