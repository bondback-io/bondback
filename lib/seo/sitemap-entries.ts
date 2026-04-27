import "server-only";

import { getSiteUrl } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FULL_HELP_ARTICLES } from "@/lib/help-articles-content";
import { TOP_BOND_CLEANING_SLUGS } from "@/lib/seo/location-top-slugs";
import { SERVICE_TYPES, type ServiceTypeKey } from "@/lib/service-types";

/** One URL row for sitemap.xml (matches Next MetadataRoute.Sitemap shape). */
export type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority: number;
};

const tier = {
  primary: { changeFrequency: "daily" as const, priority: 1.0 },
  main: { changeFrequency: "daily" as const, priority: 0.92 },
  secondary: { changeFrequency: "daily" as const, priority: 0.88 },
  suburb: { changeFrequency: "weekly" as const, priority: 0.8 },
  serviceHub: { changeFrequency: "weekly" as const, priority: 0.82 },
  listing: { changeFrequency: "daily" as const, priority: 0.74 },
  legal: { changeFrequency: "monthly" as const, priority: 0.4 },
} as const;

function dedupeByUrl(entries: SitemapEntry[]): SitemapEntry[] {
  const byUrl = new Map<string, SitemapEntry>();
  for (const e of entries) {
    const prev = byUrl.get(e.url);
    if (!prev) {
      byUrl.set(e.url, e);
      continue;
    }
    const prevT = prev.lastModified.getTime();
    const nextT = e.lastModified.getTime();
    if (nextT >= prevT) byUrl.set(e.url, e);
  }
  return [...byUrl.values()];
}

/**
 * Help centre URLs for the sitemap. Uses the service-role client only, then falls back to
 * in-app articles — never `createServerSupabaseClient()` (cookies), so this is safe from
 * `app/sitemap.xml/route.ts` and other non-request contexts.
 */
async function helpEntriesForSitemap(base: string, staticNow: Date): Promise<SitemapEntry[]> {
  const helpUpdatedBySlug = new Map<string, string>();
  let slugs: string[];

  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data: rows, error } = await admin
      .from("help_articles")
      .select("slug, updated_at")
      .eq("is_published", true)
      .order("category")
      .order("sort_order", { ascending: true });
    if (!error && rows?.length) {
      slugs = (rows as { slug: string }[]).map((r) => r.slug);
      for (const row of rows as { slug: string; updated_at?: string }[]) {
        if (row.slug && row.updated_at) helpUpdatedBySlug.set(row.slug, row.updated_at);
      }
    } else {
      slugs = FULL_HELP_ARTICLES.map((a) => a.slug);
    }
  } else {
    slugs = FULL_HELP_ARTICLES.map((a) => a.slug);
  }

  return slugs.map((slug) => ({
    url: `${base}/help/${encodeURIComponent(slug)}`,
    lastModified: helpUpdatedBySlug.has(slug) ? new Date(helpUpdatedBySlug.get(slug)!) : staticNow,
    changeFrequency: "weekly",
    priority: 0.72,
  }));
}

/** Collect all sitemap URLs (shared by `/sitemap.xml` route). */
export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
  const base = getSiteUrl().origin;
  const staticNow = new Date();
  const nowIso = staticNow.toISOString();

  const staticEntries: SitemapEntry[] = [
    { url: base, lastModified: staticNow, ...tier.primary },
    { url: `${base}/find-jobs`, lastModified: staticNow, ...tier.main },
    { url: `${base}/help`, lastModified: staticNow, ...tier.secondary },
    { url: `${base}/terms`, lastModified: staticNow, ...tier.legal },
    { url: `${base}/privacy`, lastModified: staticNow, ...tier.legal },
  ];

  const admin = createSupabaseAdminClient();

  const helpEntries = await helpEntriesForSitemap(base, staticNow);

  const serviceFilterEntries: SitemapEntry[] = (SERVICE_TYPES as readonly ServiceTypeKey[]).map(
    (serviceType) => ({
      url: `${base}/find-jobs?service_type=${encodeURIComponent(serviceType)}`,
      lastModified: staticNow,
      ...tier.serviceHub,
    })
  );

  const locationEntries: SitemapEntry[] = TOP_BOND_CLEANING_SLUGS.map((slug) => ({
    url: `${base}/bond-cleaning/${encodeURIComponent(slug)}`,
    lastModified: staticNow,
    ...tier.suburb,
  }));

  const seoLocationEntries: SitemapEntry[] = [];
  if (admin) {
    const { data: completedSuburbs } = await admin
      .from("seo_suburbs")
      .select("id")
      .eq("completed", true);

    const completedIds = (completedSuburbs ?? []).map((r) => (r as { id: string }).id);
    if (completedIds.length > 0) {
      const { data: contents } = await admin
        .from("seo_content")
        .select("page_slug, updated_at")
        .in("suburb_id", completedIds);

      const seen = new Set(TOP_BOND_CLEANING_SLUGS);
      for (const row of contents ?? []) {
        const slug = (row as { page_slug: string }).page_slug;
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        const updated = (row as { updated_at?: string }).updated_at;
        seoLocationEntries.push({
          url: `${base}/bond-cleaning/${encodeURIComponent(slug)}`,
          lastModified: updated ? new Date(updated) : staticNow,
          ...tier.suburb,
        });
      }
    }
  }

  const listingEntries: SitemapEntry[] = [];
  if (admin) {
    const { data: liveListings } = await admin
      .from("listings")
      .select("id, created_at")
      .eq("status", "live")
      .is("cancelled_early_at", null)
      .gt("end_time", nowIso);

    for (const row of liveListings ?? []) {
      const id = row.id as string;
      const lastModified = row.created_at ? new Date(row.created_at as string) : staticNow;
      listingEntries.push({
        url: `${base}/listings/${id}`,
        lastModified,
        ...tier.listing,
      });
    }
  }

  return dedupeByUrl([
    ...staticEntries,
    ...helpEntries,
    ...serviceFilterEntries,
    ...locationEntries,
    ...seoLocationEntries,
    ...listingEntries,
  ]);
}

/** Minimal sitemap if `buildSitemapEntries` throws (always 200 + valid XML). */
export function fallbackSitemapEntries(): SitemapEntry[] {
  const base = getSiteUrl().origin;
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/find-jobs`, lastModified: now, changeFrequency: "daily", priority: 0.92 },
    { url: `${base}/help`, lastModified: now, changeFrequency: "daily", priority: 0.88 },
  ];
}
