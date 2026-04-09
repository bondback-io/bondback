export type SeoTaskKey =
  | "homepage_metadata"
  | "local_schema"
  | "dynamic_location_pages"
  | "sitemap_locations"
  | "core_web_vitals"
  | "gbp"
  | "nap_consistency"
  | "suburb_landing_pages"
  | "blog_content"
  | "directory_listings"
  | "backlinks";

export type SeoChecklistItemDef = {
  key: SeoTaskKey;
  label: string;
  /**
   * false = completion tracked only via manual checklist in admin.
   * true = completion when auto-check passes (see runSeoAutoChecks).
   */
  allowAuto: boolean;
};

export const SEO_CHECKLIST_ITEMS: SeoChecklistItemDef[] = [
  {
    key: "homepage_metadata",
    label: "Homepage metadata & keywords updated",
    allowAuto: true,
  },
  {
    key: "local_schema",
    label: "LocalBusiness + Service schema added",
    allowAuto: true,
  },
  {
    key: "dynamic_location_pages",
    label: "Dynamic location pages created (Sunshine Coast suburbs)",
    allowAuto: true,
  },
  {
    key: "sitemap_locations",
    label: "XML sitemap includes all location pages",
    allowAuto: true,
  },
  {
    key: "core_web_vitals",
    label: "Core Web Vitals & mobile speed optimised",
    allowAuto: false,
  },
  {
    key: "gbp",
    label: "Google Business Profile claimed & optimised",
    allowAuto: false,
  },
  {
    key: "nap_consistency",
    label: "NAP consistency across directories",
    allowAuto: false,
  },
  {
    key: "suburb_landing_pages",
    label:
      "Suburb-specific landing pages published (Maroochydore, Caloundra, Noosa, etc.)",
    allowAuto: true,
  },
  {
    key: "blog_content",
    label: "Blog/content strategy started (minimum 5 posts)",
    allowAuto: false,
  },
  {
    key: "directory_listings",
    label: "Local directory listings completed",
    allowAuto: false,
  },
  {
    key: "backlinks",
    label: "Backlink strategy in progress",
    allowAuto: false,
  },
];
