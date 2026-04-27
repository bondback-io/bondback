import { buildSitemapEntries, fallbackSitemapEntries, type SitemapEntry } from "@/lib/seo/sitemap-entries";

/**
 * Explicit `/sitemap.xml` route so crawlers always resolve this path in production.
 * (Metadata `app/sitemap.ts` can be omitted or behave inconsistently across hosts.)
 */
export const revalidate = 600;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function entriesToXml(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => {
      const lastmod = Number.isNaN(e.lastModified.getTime())
        ? new Date().toISOString()
        : e.lastModified.toISOString();
      return [
        "  <url>",
        `    <loc>${escapeXml(e.url)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${e.changeFrequency}</changefreq>`,
        `    <priority>${e.priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    "</urlset>",
    "",
  ].join("\n");
}

export async function GET() {
  try {
    const entries = await buildSitemapEntries();
    const xml = entriesToXml(entries);
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[sitemap.xml]", err);
    const xml = entriesToXml(fallbackSitemapEntries());
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=3600",
      },
    });
  }
}
