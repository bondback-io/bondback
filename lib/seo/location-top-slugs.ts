/**
 * Precomputed slugs matching `buildLocationSlug(suburb, state, postcode)` for the
 * Australian postcodes dataset (locality names as in `public.suburbs`).
 * Used for `generateStaticParams`, sitemap, and `/cleaning/[city]` redirects.
 *
 * Sunshine Coast QLD, Gympie, and North Brisbane slugs are listed first for local SEO priority.
 */
import { SUNSHINE_COAST_REGION_BOND_CLEANING_SLUGS } from "@/lib/seo/qld-regional-static-seo";

const LEGACY_BOND_CLEANING_SLUGS: readonly string[] = [
  "sydney-nsw-2000",
  "melbourne-vic-3000",
  "brisbane-qld-4000",
  "perth-wa-6000",
  "adelaide-sa-5000",
  "canberra-act-2600",
  "hobart-tas-7000",
  "darwin-nt-0800",
  "parramatta-nsw-2150",
  "bondi-nsw-2026",
  "chatswood-nsw-2067",
  "blacktown-nsw-2148",
  "penrith-nsw-2750",
  "newcastle-nsw-2300",
  "wollongong-nsw-2500",
  "surfers-paradise-qld-4217",
  "southport-qld-4215",
  "fortitude-valley-qld-4006",
  "st-kilda-vic-3182",
  "frankston-vic-3199",
  "geelong-vic-3220",
  "fremantle-wa-6160",
  "north-sydney-nsw-2060",
  "liverpool-nsw-2170",
  "campbelltown-nsw-2560",
  "cairns-qld-4870",
  "townsville-qld-4810",
  "launceston-tas-7250",
  "bendigo-vic-3550",
  "ballarat-vic-3350",
];

/** Deduped: regional QLD focus first, then national legacy slugs. */
export const TOP_BOND_CLEANING_SLUGS: readonly string[] = [
  ...new Set([...SUNSHINE_COAST_REGION_BOND_CLEANING_SLUGS, ...LEGACY_BOND_CLEANING_SLUGS]),
];

/** Short `/cleaning/[city]` paths → primary bond-cleaning slug (SEO aliases). */
export const CLEANING_CITY_TO_SLUG: Record<string, string> = {
  sydney: "sydney-nsw-2000",
  melbourne: "melbourne-vic-3000",
  brisbane: "brisbane-qld-4000",
  perth: "perth-wa-6000",
  adelaide: "adelaide-sa-5000",
  canberra: "canberra-act-2600",
  hobart: "hobart-tas-7000",
  darwin: "darwin-nt-0800",
  "gold-coast": "surfers-paradise-qld-4217",
  parramatta: "parramatta-nsw-2150",
  newcastle: "newcastle-nsw-2300",
  wollongong: "wollongong-nsw-2500",
  "sunshine-coast": "maroochydore-qld-4558",
  maroochydore: "maroochydore-qld-4558",
  caloundra: "caloundra-qld-4551",
  noosa: "noosa-heads-qld-4567",
  gympie: "gympie-qld-4570",
  mooloolaba: "mooloolaba-qld-4557",
};
