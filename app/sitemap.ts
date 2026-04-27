import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getHelpArticles } from "@/lib/help-articles";
import { TOP_BOND_CLEANING_SLUGS } from "@/lib/seo/location-top-slugs";
import { SERVICE_TYPES, type ServiceTypeKey } from "@/lib/service-types";

/**
 * ISR for the generated sitemap document. Tune up/down based on how often listings
 * and SEO suburb rows change in production.
 */
export const revalidate = 600;

/** Priority / changefreq tiers — extend when adding hubs (e.g. a future `/blog`). */
const tier = {
  /** Homepage + primary commercial URLs */
  primary: { changeFrequency: "daily" as const, priority: 1.0 },
  /** High-value marketplace / discovery */
  main: { changeFrequency: "daily" as const, priority: 0.92 },
  /** Help centre, service-filter views */
  secondary: { changeFrequency: "daily" as const, priority: 0.88 },
  /** Location SEO landings */
  suburb: { changeFrequency: "weekly" as const, priority: 0.8 },
  /** Filtered job search by service type */
  serviceHub: { changeFrequency: "weekly" as const, priority: 0.82 },
  /** Individual live listings (public auction pages) */
  listing: { changeFrequency: "daily" as const, priority: 0.74 },
  /** Legal / low churn */
  legal: { changeFrequency: "monthly" as const, priority: 0.4 },
} as const;

type SitemapEntry = MetadataRoute.Sitemap[number];

function dedupeByUrl(entries: SitemapEntry[]): SitemapEntry[] {
  const byUrl = new Map<string, SitemapEntry>();
  for (const e of entries) {
    const prev = byUrl.get(e.url);
    if (!prev) {
      byUrl.set(e.url, e);
      continue;
    }
    const prevT =
      prev.lastModified instanceof Date
        ? prev.lastModified.getTime()
        : prev.lastModified
          ? new Date(prev.lastModified).getTime()
          : 0;
    const nextT =
      e.lastModified instanceof Date
        ? e.lastModified.getTime()
        : e.lastModified
          ? new Date(e.lastModified).getTime()
          : 0;
    if (nextT >= prevT) byUrl.set(e.url, e);
  }
  return [...byUrl.values()];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl().origin;
  const staticNow = new Date();
  const nowIso = staticNow.toISOString();

  /*
   * Intentionally omitted (keep sitemap aligned with `robots` / route metadata):
   * - `/cleaners` — index suppressed in `app/cleaners/page.tsx`
   * - `/listings/new` — index suppressed (auth-gated workflow entry)
   * - `/support` — login-gated; public “contact” path is `/help`
   * - `/jobs` — redirects to `/find-jobs` (canonical is `/find-jobs`)
   * - Dedicated `/how-it-works` — lives as `/#how-it-works` on the homepage only
   * - `/blog` — no blog app route yet; add a static entry here when it ships
   */
  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, lastModified: staticNow, ...tier.primary },
    {
      url: `${base}/find-jobs`,
      lastModified: staticNow,
      ...tier.main,
    },
    {
      url: `${base}/help`,
      lastModified: staticNow,
      ...tier.secondary,
    },
    {
      url: `${base}/terms`,
      lastModified: staticNow,
      ...tier.legal,
    },
    {
      url: `${base}/privacy`,
      lastModified: staticNow,
      ...tier.legal,
    },
  ];

  const admin = createSupabaseAdminClient();

  const helpArticles = await getHelpArticles();
  const helpUpdatedBySlug = new Map<string, string>();
  if (admin) {
    const { data: helpRows } = await admin
      .from("help_articles")
      .select("slug, updated_at")
      .eq("is_published", true);
    for (const row of helpRows ?? []) {
      const slug = (row as { slug: string }).slug;
      const u = (row as { updated_at?: string }).updated_at;
      if (slug && u) helpUpdatedBySlug.set(slug, u);
    }
  }

  const helpEntries: MetadataRoute.Sitemap = helpArticles.map((a) => ({
    url: `${base}/help/${encodeURIComponent(a.slug)}`,
    lastModified: helpUpdatedBySlug.has(a.slug)
      ? new Date(helpUpdatedBySlug.get(a.slug)!)
      : staticNow,
    changeFrequency: "weekly",
    priority: 0.72,
  }));

  /** Programmatic service “hubs” — same UI as `/find-jobs`, filtered by `service_type`. */
  const serviceFilterEntries: MetadataRoute.Sitemap = (SERVICE_TYPES as readonly ServiceTypeKey[]).map(
    (serviceType) => ({
      url: `${base}/find-jobs?service_type=${encodeURIComponent(serviceType)}`,
      lastModified: staticNow,
      ...tier.serviceHub,
    })
  );

  const locationEntries: MetadataRoute.Sitemap = TOP_BOND_CLEANING_SLUGS.map((slug) => ({
    url: `${base}/bond-cleaning/${encodeURIComponent(slug)}`,
    lastModified: staticNow,
    ...tier.suburb,
  }));

  const seoLocationEntries: MetadataRoute.Sitemap = [];
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

  const listingEntries: MetadataRoute.Sitemap = [];
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

  /*
   * We only emit `/listings/[uuid]` for open auctions, not `/jobs/[numericId]`, so we do not
   * fight the per-route `canonical` in `buildJobListingMetadata` with duplicate URLs.
   */

  return dedupeByUrl([
    ...staticEntries,
    ...helpEntries,
    ...serviceFilterEntries,
    ...locationEntries,
    ...seoLocationEntries,
    ...listingEntries,
  ]);
}
