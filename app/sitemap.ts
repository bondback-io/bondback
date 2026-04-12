import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getHelpArticles } from "@/lib/help-articles";
import { TOP_BOND_CLEANING_SLUGS } from "@/lib/seo/location-top-slugs";

const changeFreq = {
  home: "weekly" as const,
  jobs: "daily" as const,
  static: "monthly" as const,
  listing: "hourly" as const,
  help: "monthly" as const,
  location: "weekly" as const,
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl().origin;
  const now = new Date().toISOString();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: changeFreq.home, priority: 1 },
    {
      url: `${base}/jobs`,
      lastModified: new Date(),
      changeFrequency: changeFreq.jobs,
      priority: 0.95,
    },
    {
      url: `${base}/listings/new`,
      lastModified: new Date(),
      changeFrequency: changeFreq.static,
      priority: 0.88,
    },
    {
      url: `${base}/help`,
      lastModified: new Date(),
      changeFrequency: changeFreq.help,
      priority: 0.85,
    },
    {
      url: `${base}/login`,
      lastModified: new Date(),
      changeFrequency: changeFreq.static,
      priority: 0.5,
    },
    {
      url: `${base}/signup`,
      lastModified: new Date(),
      changeFrequency: changeFreq.static,
      priority: 0.55,
    },
    {
      url: `${base}/terms`,
      lastModified: new Date(),
      changeFrequency: changeFreq.static,
      priority: 0.4,
    },
    {
      url: `${base}/privacy`,
      lastModified: new Date(),
      changeFrequency: changeFreq.static,
      priority: 0.4,
    },
  ];

  const helpArticles = await getHelpArticles();
  const helpEntries: MetadataRoute.Sitemap = helpArticles.map((a) => ({
    url: `${base}/help/${encodeURIComponent(a.slug)}`,
    lastModified: new Date(),
    changeFrequency: changeFreq.help,
    priority: 0.65,
  }));

  const locationEntries: MetadataRoute.Sitemap = TOP_BOND_CLEANING_SLUGS.map((slug) => ({
    url: `${base}/bond-cleaning/${encodeURIComponent(slug)}`,
    lastModified: new Date(),
    changeFrequency: changeFreq.location,
    priority: 0.72,
  }));

  /** SEO pipeline: only list bond-cleaning URLs that are marked completed in `seo_suburbs`. */
  const seoLocationEntries: MetadataRoute.Sitemap = [];
  const admin = createSupabaseAdminClient();
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
          lastModified: updated ? new Date(updated) : new Date(),
          changeFrequency: changeFreq.location,
          priority: 0.72,
        });
      }
    }
  }

  const dynamicEntries: MetadataRoute.Sitemap = [];
  if (admin) {
    const { data: liveListings } = await admin
      .from("listings")
      .select("id, created_at")
      .eq("status", "live")
      .is("cancelled_early_at", null)
      .gt("end_time", now);

    for (const row of liveListings ?? []) {
      const id = row.id as string;
      const updated = row.created_at ? new Date(row.created_at as string) : new Date();
      dynamicEntries.push({
        url: `${base}/listings/${id}`,
        lastModified: updated,
        changeFrequency: changeFreq.listing,
        priority: 0.75,
      });
    }
  }

  return [
    ...staticEntries,
    ...helpEntries,
    ...locationEntries,
    ...seoLocationEntries,
    ...dynamicEntries,
  ];
}
