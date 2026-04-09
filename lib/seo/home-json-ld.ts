import type { SuburbSeoRow } from "@/lib/seo/suburb-seo-types";

/** Shared Org id used for JSON-LD @id references across the site. */
export const BOND_BACK_ORG_ID = (origin: string) => `${origin}/#org`;

export function buildHomePageJsonLd(origin: string): Record<string, unknown> {
  const orgId = BOND_BACK_ORG_ID(origin);
  const localId = `${origin}/#localbusiness`;
  const serviceId = `${origin}/#bondservice`;

  const localBusiness: Record<string, unknown> = {
    "@type": "LocalBusiness",
    "@id": localId,
    name: "Bond Back",
    description:
      "Australian marketplace for bond cleaning Sunshine Coast, end of lease cleaning, and bond cleans across Australia. Serving renters and cleaners in Queensland and nationwide.",
    url: origin,
    parentOrganization: { "@id": orgId },
    address: {
      "@type": "PostalAddress",
      addressRegion: "QLD",
      addressCountry: "AU",
    },
    areaServed: [
      {
        "@type": "AdministrativeArea",
        name: "Sunshine Coast Region, Queensland",
      },
      { "@type": "Country", name: "Australia" },
    ],
    priceRange: "$$",
  };

  const service: Record<string, unknown> = {
    "@type": "Service",
    "@id": serviceId,
    name: "Bond cleaning & end of lease cleaning",
    serviceType: "Bond cleaning",
    provider: { "@id": orgId },
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Sunshine Coast, Gympie, North Brisbane & Australia",
    },
    url: origin,
    description:
      "Post a bond clean or compare cleaner bids in a reverse auction — ideal for end of lease and vacate cleaning.",
  };

  const faq: Record<string, unknown> = {
    "@type": "FAQPage",
    "@id": `${origin}/#faq`,
    mainEntity: [
      {
        "@type": "Question",
        name: "What is bond cleaning on the Sunshine Coast?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Bond cleaning (end of lease or vacate cleaning) is a thorough clean to meet rental inspection standards so you can recover your bond. Bond Back connects renters with cleaners who bid for your job across the Sunshine Coast and Australia.",
        },
      },
      {
        "@type": "Question",
        name: "How does Bond Back pricing work?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Cleaners place competitive bids in a reverse auction, so you can compare transparent prices before you lock in your bond clean.",
        },
      },
      {
        "@type": "Question",
        name: "Is Bond Back only for Bond cleaning Sunshine Coast?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "We highlight Sunshine Coast and Queensland locations for local search, but Bond Back is Australia-wide — listers and cleaners can use the platform across the country.",
        },
      },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "Bond Back",
        url: origin,
        description:
          "Australian marketplace for bond cleaning and end of lease cleaning.",
      },
      localBusiness,
      service,
      faq,
    ],
  };
}

/** FAQ node for `@graph` on location landing pages (`/bond-cleaning/[slug]`). */
export function buildLocationFaqGraphNode(
  row: SuburbSeoRow,
  pageUrl: string
): Record<string, unknown> {
  const area = `${row.suburb}, ${row.state}`;
  return {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: [
      {
        "@type": "Question",
        name: `Where can I find bond cleaning in ${row.suburb}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Bond Back lists bond cleaning and end of lease cleaning jobs in ${area} — compare cleaner bids and book a vacate clean for your rental.`,
        },
      },
      {
        "@type": "Question",
        name: `What is end of lease cleaning in ${row.suburb}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "End of lease cleaning is a detailed clean before your final inspection so you can maximise your bond return. Post your job on Bond Back to receive bids from cleaners in your area.",
        },
      },
    ],
  };
}
