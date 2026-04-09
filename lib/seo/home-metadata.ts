import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site";

/** Primary local SEO phrases (Sunshine Coast QLD focus). */
export const HOME_PRIMARY_LOCAL_KEYWORDS = [
  "bond cleaning Sunshine Coast",
  "end of lease cleaning Sunshine Coast",
  "bond clean Sunshine Coast",
  "bond cleaning Maroochydore",
  "end of lease cleaning Caloundra",
  "bond clean Noosa",
  "bond cleaning Gympie",
  "vacate cleaning Queensland",
] as const;

export function buildHomePageMetadata(): Metadata {
  const site = getSiteUrl();
  const canonical = `${site.origin}/`;
  const title =
    "Bond cleaning Sunshine Coast & Australia | End of lease cleaning";
  const description =
    "Bond cleaning Sunshine Coast, end of lease cleaning, and bond cleans across Australia. Compare cleaner bids for your rental bond clean — Maroochydore, Caloundra, Noosa, Gympie & North Brisbane. Secure payments on Bond Back.";

  return {
    title,
    description,
    keywords: [
      ...HOME_PRIMARY_LOCAL_KEYWORDS,
      "bond cleaning",
      "end of lease cleaning",
      "bond back",
      "vacate cleaning",
      "reverse auction cleaning",
    ],
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "en_AU",
      url: canonical,
      siteName: "Bond Back",
      title: `${title} · Bond Back`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Bond Back`,
      description,
    },
  };
}
