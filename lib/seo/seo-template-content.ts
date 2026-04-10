import type { SeoGeneratedBundle } from "@/lib/seo/seo-content-types";

function kebab(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Deterministic fallback when AI keys are missing or generation fails. */
export function buildTemplateSeoBundle(input: {
  suburbName: string;
  postcode: string;
  state: string;
  regionName: string;
}): SeoGeneratedBundle {
  const { suburbName, postcode, state, regionName } = input;
  const slugBase = kebab(suburbName);

  const metaTitle = `Bond cleaning ${suburbName} ${state} | End of lease | Bond Back`;
  const metaDescription = `Compare bond cleaning bids in ${suburbName} (${state} ${postcode}). End of lease and vacate cleaning on Bond Back — ${regionName}.`;

  return {
    landing: {
      heroTitle: `Bond cleaning & end of lease cleaning in ${suburbName}`,
      heroSubtitle: `Transparent bids from cleaners in ${regionName} — postcode ${postcode}.`,
      sections: [
        {
          heading: `Why compare bond cleaning in ${suburbName}?`,
          bodyMarkdown: `Renters in **${suburbName}** can post their vacate clean and receive competitive bids instead of chasing one-off quotes. Bond Back is built for Australian **bond cleaning** and **end of lease cleaning** with clear pricing before you book.`,
        },
        {
          heading: "What is bond cleaning?",
          bodyMarkdown:
            "Bond cleaning (also called vacate or exit cleaning) is a thorough clean aligned with rental inspection expectations. Scope varies by property; always confirm inclusions with your cleaner.",
        },
        {
          heading: "How Bond Back works",
          bodyMarkdown:
            "1. Post your job with details and photos.\n2. Cleaners place bids in a **reverse auction**.\n3. Choose a bid that fits your timeline and budget.\n4. Complete payment flows on the platform when you hire.",
        },
      ],
    },
    blogPosts: [
      {
        slug: `${slugBase}-bond-cleaning-checklist`,
        title: `Bond cleaning checklist before handover in ${suburbName}`,
        excerpt: `Practical steps to prepare for a rental inspection after a bond clean in ${postcode}.`,
        bodyMarkdown: `## Before the cleaner arrives\n\n- Remove personal items and rubbish.\n- Note oven, carpets, and bathrooms as typical focus areas.\n- Keep communication in the Bond Back thread.\n\n## After the clean\n\n- Walk through with photos if possible before the agent visit.`,
      },
      {
        slug: `${slugBase}-end-of-lease-timing`,
        title: `End of lease cleaning timing in ${state}`,
        excerpt: "How to line up your vacate clean with keys and inspection.",
        bodyMarkdown: `## Scheduling\n\nBook your end of lease clean so there is buffer before the final inspection. Allow time for any touch-ups if the property manager requests them.`,
      },
      {
        slug: `${slugBase}-local-bond-cleaning`,
        title: `${suburbName} bond cleaning: compare bids on Bond Back`,
        excerpt: `Local search for bond cleaning in ${suburbName} — compare cleaner bids instead of ring-arounds.`,
        bodyMarkdown: `## ${suburbName} and ${regionName}\n\nBond Back helps renters in **${suburbName}** find bond cleaning without endless callbacks. Post once, receive bids, and choose what works for you.`,
      },
    ],
    faq: {
      questions: [
        {
          question: `Where can I book bond cleaning in ${suburbName}?`,
          answer: `You can post a bond cleaning job on Bond Back and receive bids from cleaners who service ${suburbName} and surrounding areas in ${state}.`,
        },
        {
          question: "What is end of lease cleaning?",
          answer:
            "End of lease cleaning is a detailed clean before your final inspection to help maximise your bond return. It is often similar to bond cleaning terminology in Australia.",
        },
        {
          question: "How does pricing work on Bond Back?",
          answer:
            "Cleaners submit bids for your posted job. You compare offers and choose a bid before hiring, instead of opaque quote shopping.",
        },
        {
          question: `Does Bond Back only serve ${suburbName}?`,
          answer:
            "Bond Back operates Australia-wide. This page highlights local SEO for your area; listers and cleaners can use the platform across the country.",
        },
      ],
    },
    metaTitle: metaTitle.slice(0, 70),
    metaDescription: metaDescription.slice(0, 160),
  };
}
