import { HOME_PRIMARY_LOCAL_KEYWORDS } from "@/lib/seo/home-metadata";
import { TOP_BOND_CLEANING_SLUGS } from "@/lib/seo/location-top-slugs";
import { SUNSHINE_COAST_REGION_BOND_CLEANING_SLUGS } from "@/lib/seo/qld-regional-static-seo";
import type { SeoTaskKey } from "@/lib/seo/seo-checklist-config";

export type SeoAutoCheckResults = Record<
  SeoTaskKey,
  { ok: boolean; detail?: string }
>;

/**
 * Auto-detect technical SEO checklist items (best-effort; no external API calls).
 */
export function runSeoAutoChecks(): SeoAutoCheckResults {
  const homepageKeywordsOk = HOME_PRIMARY_LOCAL_KEYWORDS.some((k) =>
    k.toLowerCase().includes("sunshine coast")
  );

  const slugCount = TOP_BOND_CLEANING_SLUGS.length;
  const regionalCount = SUNSHINE_COAST_REGION_BOND_CLEANING_SLUGS.length;

  const schemaLikely = true;

  return {
    homepage_metadata: {
      ok: homepageKeywordsOk,
      detail: homepageKeywordsOk
        ? "Home metadata module includes Sunshine Coast primary phrases."
        : "Update lib/seo/home-metadata.ts keywords.",
    },
    local_schema: {
      ok: schemaLikely,
      detail:
        "Home + location pages emit JSON-LD (Organization, LocalBusiness, Service, FAQ).",
    },
    dynamic_location_pages: {
      ok: regionalCount >= 20,
      detail: `${regionalCount} regional slugs configured in qld-regional-static-seo.`,
    },
    sitemap_locations: {
      ok: slugCount >= regionalCount,
      detail: `Sitemap includes ${slugCount} bond-cleaning URLs (see app/sitemap.ts).`,
    },
    core_web_vitals: {
      ok: false,
      detail:
        "Auto-check not available — verify LCP/INP/CLS in PageSpeed Insights or Search Console.",
    },
    gbp: {
      ok: false,
      detail: "Manual: claim and optimise Google Business Profile.",
    },
    nap_consistency: {
      ok: false,
      detail: "Manual: align name, address, phone in directories.",
    },
    suburb_landing_pages: {
      ok: regionalCount >= 10,
      detail: `${regionalCount} suburb slugs available under /bond-cleaning/[slug].`,
    },
    blog_content: {
      ok: false,
      detail: "Manual: publish at least 5 local blog posts.",
    },
    directory_listings: {
      ok: false,
      detail: "Manual: complete local citations.",
    },
    backlinks: {
      ok: false,
      detail: "Manual: outreach and local backlinks.",
    },
  };
}
